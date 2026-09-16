/**
 * 本地签名去纸底：输入为未预乘的 RGBA，原位修改，不依赖 Canvas/平台 API。
 * 已有透明通道的图片原样保留，避免再次抠图损伤细笔画。
 */
const luma = (r, g, b) => Math.round(0.299 * r + 0.587 * g + 0.114 * b);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function percentile(histogram, count, fraction) {
    const target = Math.max(1, Math.ceil(count * fraction));
    let sum = 0;
    for (let value = 0; value < histogram.length; value += 1) {
        sum += histogram[value];
        if (sum >= target) return value;
    }
    return 255;
}

function paperPixel(data, i, minimum) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return data[i + 3] === 255 && luma(r, g, b) >= minimum &&
        Math.max(r, g, b) - Math.min(r, g, b) <= 80;
}

function samplePaper(data, width, x0, y0, x1, y1, minimum, borderOnly = false) {
    const histograms = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 40));
    const band = Math.max(1, Math.round(Math.min(x1 - x0, y1 - y0) * 0.04));
    let count = 0, total = 0;
    for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
            if (borderOnly && x >= x0 + band && x < x1 - band && y >= y0 + band && y < y1 - band) continue;
            total += 1;
            const i = (y * width + x) * 4;
            if (!paperPixel(data, i, minimum)) continue;
            for (let c = 0; c < 3; c += 1) histograms[c][data[i + c]] += 1;
            count += 1;
        }
    }
    if (!count || count < total * 0.5) return null;
    return histograms.map(histogram => percentile(histogram, count, 0.5));
}

// 在网格中心之间插值，边缘做半个网格以内的外推，避免渐变纸张留下边框。
function axisSamples(length, count) {
    return Array.from({ length }, (_, position) => {
        if (count === 1) return { first: 0, second: 0, weight: 0 };
        const coordinate = (position + 0.5) * count / length - 0.5;
        const first = clamp(Math.floor(coordinate), 0, count - 2);
        return { first, second: first + 1, weight: coordinate - first };
    });
}

function removeSignatureBackground(imageData) {
    const { data, width, height } = imageData || {};
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        !data || data.length !== width * height * 4) {
        throw new Error('签名像素数据无效');
    }
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) return { changed: false, reason: 'transparent' };
    }

    const paper = samplePaper(data, width, 0, 0, width, height, 150, true);
    if (!paper) return { changed: false, reason: 'unsupported-background' };

    const paperLuma = luma(...paper);
    const cellSize = clamp(Math.round(Math.min(width, height) / 6), 32, 96);
    const columns = Math.max(1, Math.floor(width / cellSize));
    const rows = Math.max(1, Math.floor(height / cellSize));
    const grid = [];
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            grid.push(samplePaper(data, width,
                Math.floor(column * width / columns), Math.floor(row * height / rows),
                Math.floor((column + 1) * width / columns), Math.floor((row + 1) * height / rows),
                Math.max(110, paperLuma - 85)));
        }
    }
    // 笔画占满的网格使用最近的有效纸张网格，不能把深色笔画当作纸张。
    const validCells = grid.map((color, index) => color ? index : -1).filter(index => index >= 0);
    for (let index = 0; index < grid.length; index += 1) {
        if (grid[index]) continue;
        let nearest = -1, distance = Infinity;
        for (const candidate of validCells) {
            const dx = candidate % columns - index % columns;
            const dy = Math.floor(candidate / columns) - Math.floor(index / columns);
            if (dx * dx + dy * dy < distance) {
                distance = dx * dx + dy * dy;
                nearest = candidate;
            }
        }
        grid[index] = nearest >= 0 ? grid[nearest] : paper;
    }

    const xs = axisSamples(width, columns), ys = axisSamples(height, rows);
    const backgrounds = new Float32Array(width * height * 3);
    const inkHistogram = new Uint32Array(256);
    let inkSamples = 0;
    for (let y = 0; y < height; y += 1) {
        const sy = ys[y];
        for (let x = 0; x < width; x += 1) {
            const sx = xs[x], p = y * width + x, i = p * 4;
            let contrast = 0;
            for (let c = 0; c < 3; c += 1) {
                const top = grid[sy.first * columns + sx.first][c] * (1 - sx.weight) + grid[sy.first * columns + sx.second][c] * sx.weight;
                const bottom = grid[sy.second * columns + sx.first][c] * (1 - sx.weight) + grid[sy.second * columns + sx.second][c] * sx.weight;
                const bg = clamp(top * (1 - sy.weight) + bottom * sy.weight, 100, 255);
                backgrounds[p * 3 + c] = bg;
                contrast = Math.max(contrast, bg - data[i + c]);
            }
            if (contrast > 40) {
                inkHistogram[Math.min(data[i], data[i + 1], data[i + 2])] += 1;
                inkSamples += 1;
            }
        }
    }

    // 低分位数估计墨色最暗通道，既保留灰色墨水，也支持蓝/红色签名。
    const inkFloor = inkSamples ? Math.min(180, percentile(inkHistogram, inkSamples, 0.02)) : 0;
    let visiblePixels = 0;
    for (let p = 0; p < width * height; p += 1) {
        const i = p * 4;
        let alpha = 0, contrast = 0;
        for (let c = 0; c < 3; c += 1) {
            const bg = backgrounds[p * 3 + c];
            const difference = bg - data[i + c];
            contrast = Math.max(contrast, difference);
            alpha = Math.max(alpha, difference / Math.max(32, bg - inkFloor));
        }
        alpha = clamp(alpha, 0, 1);
        // 只在接近纸张噪声的区间柔化，不做会吞掉句点/细笔画的腐蚀或面积过滤。
        const feather = clamp((contrast - 8) / 10, 0, 1);
        alpha *= feather * feather * (3 - 2 * feather);
        const alphaByte = Math.round(alpha * 255);
        if (alphaByte === 0) {
            data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
            continue;
        }
        visiblePixels += 1;
        // C = alpha * F + (1-alpha) * B：反解 F，消除纸张混入边缘产生的白边。
        for (let c = 0; c < 3; c += 1) {
            data[i + c] = clamp(Math.round((data[i + c] - (1 - alpha) * backgrounds[p * 3 + c]) / alpha), 0, 255);
        }
        data[i + 3] = alphaByte;
    }
    return { changed: true, reason: visiblePixels ? 'removed' : 'empty' };
}

export { removeSignatureBackground };
