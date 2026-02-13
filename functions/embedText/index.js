/**
 * embedText 云函数
 * 输入: { texts: string[] }
 * 输出: { success: true, embeddings: number[][], dim: number }
 * 依赖: onnxruntime-node + @huggingface/tokenizers
 * 模型文件放在 ./model/ 目录下:
 *   - model_04.onnx (或你选择的 onnx)
 *   - tokenizer.json / tokenizer_config.json / vocab.txt / special_tokens_map.json / config.json
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const ort = require('onnxruntime-node');

// 模型与分词文件默认托管在 HuggingFace，首次冷启动会下载到 /tmp/embed-model
const DEFAULT_BASE =
  process.env.EMBED_BASE_URL ||
  'https://huggingface.co/shibing624/text2vec-base-chinese/resolve/main/onnx';
const MODEL_FILE = process.env.EMBED_MODEL_FILE || 'model_qint8_avx512_vnni.onnx'; // 103MB
const TOKEN_FILES = [
  'tokenizer.json',
  'tokenizer_config.json',
  'vocab.txt',
  'special_tokens_map.json',
  'config.json'
];
const MAX_LEN = Number(process.env.EMBED_MAX_LEN || 128);
const CACHE_DIR = process.env.EMBED_CACHE_DIR || '/tmp/embed-model';

let session = null;
let vocab = null;
let tokenToId = null;
let CLS_ID = 101;
let SEP_ID = 102;
let PAD_ID = 0;
let UNK_ID = 100;

async function loadSession() {
  if (session) return session;
  const modelPath = await ensureFile(MODEL_FILE);
  session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpuExecutionProvider']
  });
  return session;
}

function loadVocab() {
  if (vocab && tokenToId) return;
  const vocabPath = path.join(CACHE_DIR, 'vocab.txt');
  const lines = fs.readFileSync(vocabPath, 'utf8').split(/\r?\n/).filter(Boolean);
  vocab = lines;
  tokenToId = new Map();
  lines.forEach((t, idx) => tokenToId.set(t, idx));
  // 常见 BERT token id
  PAD_ID = tokenToId.get('[PAD]') ?? 0;
  CLS_ID = tokenToId.get('[CLS]') ?? 101;
  SEP_ID = tokenToId.get('[SEP]') ?? 102;
  UNK_ID = tokenToId.get('[UNK]') ?? 100;
}

// 简易 wordpiece
function wordpiece(token) {
  const maxInputChars = 100;
  if (!token) return [UNK_ID];
  if (token.length > maxInputChars) return [UNK_ID];
  const subTokens = [];
  let start = 0;
  while (start < token.length) {
    let end = token.length;
    let cur = null;
    while (start < end) {
      let substr = token.slice(start, end);
      if (start > 0) substr = '##' + substr;
      if (tokenToId.has(substr)) {
        cur = tokenToId.get(substr);
        break;
      }
      end -= 1;
    }
    if (cur == null) {
      return [UNK_ID];
    }
    subTokens.push(cur);
    start = end;
  }
  return subTokens;
}

// 基础分词：对中文逐字，对其它按空格拆分
function basicTokenize(text) {
  const out = [];
  for (const ch of text) {
    if (/[\u4e00-\u9fa5]/.test(ch)) {
      out.push(ch);
    }
  }
  const others = text.split(/[\s]+/).filter(Boolean);
  return others.length ? others : out;
}

function tokenize(text) {
  loadVocab();
  const tokens = basicTokenize(text || '');
  let ids = [CLS_ID];
  tokens.forEach((t) => {
    ids = ids.concat(wordpiece(t));
  });
  ids.push(SEP_ID);
  if (ids.length > MAX_LEN) {
    ids = ids.slice(0, MAX_LEN);
    ids[ids.length - 1] = SEP_ID; // 确保结尾 SEP
  }
  const attn = Array(ids.length).fill(1);
  // padding
  while (ids.length < MAX_LEN) {
    ids.push(PAD_ID);
    attn.push(0);
  }
  return { ids, attentionMask: attn };
}

function buildInputs(batchEncoded) {
  const batchSize = batchEncoded.length;
  const ids = [];
  const mask = [];
  const tokenType = [];

  for (let i = 0; i < batchSize; i += 1) {
    const enc = batchEncoded[i];
    ids.push(...enc.ids);
    mask.push(...enc.attentionMask);
    tokenType.push(...Array(MAX_LEN).fill(0));
  }

  const inputIdsTensor = new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [
    batchSize,
    MAX_LEN
  ]);
  const attnTensor = new ort.Tensor('int64', BigInt64Array.from(mask.map(BigInt)), [
    batchSize,
    MAX_LEN
  ]);
  const tokenTypeTensor = new ort.Tensor(
    'int64',
    BigInt64Array.from(tokenType.map(BigInt)),
    [batchSize, MAX_LEN]
  );

  return {
    input_ids: inputIdsTensor,
    attention_mask: attnTensor,
    token_type_ids: tokenTypeTensor
  };
}

async function runModel(texts) {
  const sess = await loadSession();
  // 确保分词文件已就绪
  await ensureTokens();
  const encoded = texts.map((t) => tokenize(t || ''));
  const inputs = buildInputs(encoded);

  const output = await sess.run(inputs);
  let emb = null;
  if (output.sentence_embedding) {
    emb = output.sentence_embedding.data;
    const dim = output.sentence_embedding.dims[1];
    return reshape(emb, dim);
  }
  if (output.last_hidden_state) {
    const dims = output.last_hidden_state.dims; // [batch, seq, dim]
    const [batch, seq, dim] = dims;
    const data = output.last_hidden_state.data;
    const res = [];
    for (let b = 0; b < batch; b += 1) {
      const base = b * seq * dim;
      const sum = new Array(dim).fill(0);
      for (let s = 0; s < seq; s += 1) {
        const offset = base + s * dim;
        for (let d = 0; d < dim; d += 1) sum[d] += data[offset + d];
      }
      res.push(sum.map((v) => v / seq));
    }
    return res;
  }
  throw new Error('No usable output in ONNX model');
}

function reshape(flat, dim) {
  const res = [];
  for (let i = 0; i < flat.length; i += dim) {
    res.push(Array.from(flat.slice(i, i + dim)));
  }
  return res;
}

async function ensureTokens() {
  await Promise.all(TOKEN_FILES.map((f) => ensureFile(f)));
}

async function ensureFile(fileName) {
  // 1) /tmp 缓存
  const cachePath = path.join(CACHE_DIR, fileName);
  if (fs.existsSync(cachePath)) return cachePath;

  // 2) 本地 model 目录（开发模式可放置）
  const localPath = path.join(__dirname, 'model', fileName);
  if (fs.existsSync(localPath)) {
    await fs.promises.mkdir(CACHE_DIR, { recursive: true });
    await fs.promises.copyFile(localPath, cachePath);
    return cachePath;
  }

  // 3) 远程下载
  await fs.promises.mkdir(CACHE_DIR, { recursive: true });
  const url = `${DEFAULT_BASE}/${encodeURIComponent(fileName)}`;
  await download(url, cachePath);
  return cachePath;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed ${res.statusCode} ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

exports.main = async (event) => {
  try {
    const texts = Array.isArray(event && event.texts) ? event.texts : [];
    if (!texts.length) {
      return { success: false, message: 'texts 不能为空' };
    }
    const embeddings = await runModel(texts);
    return { success: true, embeddings, dim: embeddings[0]?.length || 0 };
  } catch (err) {
    console.error('[embedText] failed', err);
    return { success: false, message: String(err) };
  }
};
