const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function main() {
    const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true
    });
    const output = path.resolve(__dirname, '../output/poem-selection-20261105');
    fs.mkdirSync(output, { recursive: true });
    let page;
    const attributeWarnings = [];
    try {
        page = await browser.newPage();
        page.on('console', message => {
            if (/Extraneous non-props attributes \(id/.test(message.text())) attributeWarnings.push(message.text());
        });
        page.setDefaultTimeout(15000);
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        await page.goto((process.env.H5_URL || 'http://127.0.0.1:8081/') + '#/pages/login/login', { waitUntil: 'networkidle2' });
        await page.evaluate(() => {
            uni.setStorageSync('privacyConsentVersion', '2026-10-14');
            uni.reLaunch({ url: '/pages/login/login' });
        });
        await page.waitForFunction(() => getCurrentPages().at(-1)?.route === 'pages/login/login');
        await page.waitForFunction(() => typeof getCurrentPages === 'function' && getCurrentPages().at(-1)?.$vm);
        await page.evaluate(async () => {
            const source = await (await fetch('/components/add/PoemTypographyToolbar.vue')).text();
            const { h, render, nextTick } = await import(source.match(/from "([^"\n]*vue\.runtime\.esm\.js[^"\n]*)"/)[1]);
            const add = (await import('/pages-publish/add/add.vue')).default;
            const preview = (await import('/pages-publish/preview/preview.vue')).default;
            const detail = (await import('/pages/post-detail/post-detail.vue')).default;
            const theme = await import('/utils/theme.js');
            document.querySelector('uni-app').style.display = 'none';
            const container = document.createElement('div');
            container.id = 'typography-review';
            container.style.cssText = 'position:fixed;inset:0;z-index:100;overflow:auto;background:var(--app-page-bg,#fff)';
            document.body.appendChild(container);
            const pageVm = getCurrentPages().at(-1).$vm;
            const context = { ...pageVm.$.appContext, provides: pageVm.$.provides };
            const review = window.__typographyReview = {};
            const content = '风从窗前经过\n把一页空白翻向远方\n\n我将未说完的话\n轻轻放回月光里';
            function find(node, name) {
                if (node?.component?.type?.name === name) return node.component.proxy;
                if (node?.component) return find(node.component.subTree, name);
                for (const child of Array.isArray(node?.children) ? node.children : []) {
                    const result = find(child, name);
                    if (result) return result;
                }
            }
            function findAll(node, name, result = []) {
                if (node?.component?.type?.name === name) result.push(node.component.proxy);
                if (node?.component) findAll(node.component.subTree, name, result);
                for (const child of Array.isArray(node?.children) ? node.children : []) findAll(child, name, result);
                return result;
            }
            review.mount = async (kind, mode, series = false, restored = null) => {
                render(null, container);
                theme.setThemeMode(mode);
                const original = kind === 'add' ? add : kind === 'detail' ? detail : preview;
                const node = h({ ...original, onLoad: undefined, onShow: undefined, onReady: undefined, onHide: undefined, onUnload: undefined, onBackPress: undefined,
                    beforeCreate() { this.$.$pageInstance = pageVm.$; },
                    methods: { ...original.methods, scheduleWorkingDraftSave() {}, goBack() {}, exitWithOptionalSave() {}, getAddPageVm() { return null; } }
                }, kind === 'detail' ? { id: 'review-post-detail', 'data-review-page': 'detail' } : null);
                node.appContext = context;
                render(node, container);
                const instance = review.instance = node.component.proxy;
                if (kind === 'add') Object.assign(instance, { publishMode: 'poem', isOriginal: true, content, poemFontSize: 14,
                    poemTextStyles: [], isSeries: series, seriesBlocks: [{ id: 'one', subtitle: '窗前', content }, { id: 'two', subtitle: '远方', content: '  夜色缓缓经过\n\n一盏灯还醒着' }], ...(restored || {}) });
                else if (kind === 'preview') instance.post = instance.preparePreviewPost({ isPoem: true, isOriginal: true, isExpanded: true, title: '把月光留在纸上', author: '林间',
                    content, backgroundColor: '#a4c4bd', textColor: '#333333', poemFontSize: 14, ...(restored || {}),
                    editData: { publishMode: 'poem', isOriginal: true, ...(restored || {}) } });
                await nextTick();
                review.refreshEditors = () => {
                    review.editor = find(node.component.subTree, 'PoemTextEditor');
                    review.toolbar = find(node.component.subTree, 'PoemTypographyToolbar');
                    review.editors = findAll(node.component.subTree, 'PoemTextEditor');
                    review.toolbars = findAll(node.component.subTree, 'PoemTypographyToolbar');
                };
                review.refreshEditors();
            };
            review.select = (paragraph, start, end, editorIndex = 0) => {
                review.editor = review.editors[editorIndex];
                review.toolbar = review.toolbars[editorIndex];
                const root = document.querySelectorAll('#typography-review .ql-editor')[editorIndex];
                root.focus();
                const walker = document.createTreeWalker(root.querySelectorAll('p')[paragraph], NodeFilter.SHOW_TEXT);
                const points = [];
                let offset = 0;
                while (walker.nextNode()) {
                    const node = walker.currentNode;
                    points.push({ node, start: offset, end: offset + node.textContent.length });
                    offset += node.textContent.length;
                }
                const left = points.find(point => point.end >= start);
                const right = points.find(point => point.end >= end);
                const range = document.createRange();
                range.setStart(left.node, start - left.start);
                range.setEnd(right.node, end - right.start);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            };
        });
        const toolbar = '#typography-review .poem-typography-toolbar';
        async function ready() {
            await page.waitForFunction(() => window.__typographyReview.editor?.ready);
            await page.waitForSelector('#typography-review .ql-editor p');
            await page.waitForFunction(() => document.querySelector('#typography-review .ql-editor').textContent.includes('风从窗前经过'));
        }
        async function select(paragraph, start, end, expected, editorIndex = 0) {
            await page.evaluate(({ paragraph, start, end, editorIndex }) => window.__typographyReview.select(paragraph, start, end, editorIndex), { paragraph, start, end, editorIndex });
            await page.waitForFunction(async text => new Promise(resolve => window.__typographyReview.editor.editorContext.getSelectionText({ success: result => resolve(result.text === text) })), {}, expected);
        }
        async function enter(size, controls = toolbar) {
            const input = await page.$(controls + ' input');
            await input.focus();
            await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
            await page.keyboard.press('Backspace'); await input.type(String(size)); await page.keyboard.press('Enter');
            await input.evaluate(el => el.blur());
            await page.waitForFunction(size => window.__typographyReview.editor.styles.some(style => style.fontSize === size), {}, size);
        }
        async function choose(label, index) {
            const current = await page.evaluate(label => {
                const tools = window.__typographyReview.toolbar;
                return tools.formatIndex([...tools.colorTools, ...tools.spacingTools].find(tool => tool.label === label));
            }, label);
            await page.click(toolbar + ` [aria-label="${label}"]`);
            await page.waitForSelector('.uni-picker-toggle', { visible: true });
            const dropdown = await page.$('.uni-picker-toggle .uni-picker-select');
            if (dropdown && await dropdown.evaluate(el => getComputedStyle(el).display !== 'none')) {
                await page.click(`.uni-picker-toggle .uni-picker-select .uni-picker-item:nth-child(${index + 1})`);
            } else {
                await page.waitForFunction(() => document.querySelector('.uni-picker-toggle .uni-picker-view-group').getBoundingClientRect().bottom <= innerHeight + 1);
                const wheel = await page.$('.uni-picker-toggle .uni-picker-view-group');
                const bounds = await wheel.boundingBox();
                await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
                for (let position = current; position !== index;) {
                    const direction = index > current ? 1 : -1;
                    await page.mouse.wheel({ deltaY: direction * 40 });
                    position += direction;
                    await page.waitForFunction(position => {
                        const root = document.querySelector('.uni-picker-toggle');
                        const option = root.querySelectorAll('.uni-picker-content .uni-picker-item')[position].getBoundingClientRect();
                        const indicator = root.querySelector('.uni-picker-view-indicator').getBoundingClientRect();
                        return Math.abs((option.top + option.bottom) / 2 - (indicator.top + indicator.bottom) / 2) < 1;
                    }, {}, position);
                }
                await page.click('.uni-picker-toggle .uni-picker-action-confirm');
            }
            await page.waitForSelector('.uni-picker-toggle', { hidden: true });
            await page.waitForFunction(() => [...document.querySelectorAll('.uni-picker-mask')].every(el => getComputedStyle(el).display === 'none'));
        }
        for (const mode of ['light', 'dark']) {
            for (const width of [320, 390]) {
                await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
                await page.evaluate(mode => window.__typographyReview.mount('add', mode), mode);
                await ready();
                const bounds = await page.$eval(toolbar, el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.getBoundingClientRect().height }));
                assert.ok(bounds.scrollWidth <= bounds.width + 1, `${width} ${mode}: toolbar fits`);
                assert.ok(bounds.height <= 44, `${width} ${mode}: toolbar stays on one compact row`);
                await page.waitForSelector(toolbar + ' .toolbar-scroll-next');
                await page.waitForFunction(() => window.__typographyReview.toolbar.canScrollForward);
                const arrow = await page.$eval(toolbar + ' .toolbar-scroll-next', el => {
                    const bar = el.closest('.poem-typography-toolbar').getBoundingClientRect();
                    const icon = el.querySelector('.toolbar-chevron').getBoundingClientRect();
                    return { center: (icon.top + icon.bottom) / 2, expected: (bar.top + bar.bottom) / 2 };
                });
                assert.ok(Math.abs(arrow.center - arrow.expected) < 1, `${width} ${mode}: arrow is vertically centered in the gray bar`);
                await page.click(toolbar + ' .toolbar-scroll-next');
                await page.waitForFunction(() => window.__typographyReview.toolbar.toolsScrollPosition > 100);
                await page.click(toolbar + ' .toolbar-scroll-prev');
                await page.waitForFunction(() => window.__typographyReview.toolbar.toolsScrollPosition < 3);
                await page.waitForFunction(() => {
                    const note = document.querySelector('#typography-review .editor-footnote').getBoundingClientRect();
                    const buttons = [...document.querySelectorAll('#typography-review .back-icon, #typography-review .floating-action-btn')].map(el => el.getBoundingClientRect());
                    return buttons.every(button => button.top >= note.bottom + 4);
                });
                await select(0, 2, 4, '窗前');
                await enter(24);
                assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(window.__typographyReview.instance.poemTextStyles))), [{ start: 2, end: 4, fontSize: 24 }]);
                assert.equal(await page.evaluate(() => window.__typographyReview.instance.poemFontSize), 14);
                await select(1, 0, 9, '把一页空白翻向远方');
                await enter(20);
                await page.click(toolbar + ' .size-step:last-child');
                await page.waitForFunction(() => window.__typographyReview.instance.poemTextStyles.some(style => style.fontSize === 21));
                await page.click(toolbar + ' .size-step:first-child');
                await page.waitForFunction(() => window.__typographyReview.instance.poemTextStyles.some(style => style.fontSize === 20));
                await page.click(toolbar + ' .size-reset');
                await page.waitForFunction(() => window.__typographyReview.instance.poemTextStyles.some(style => style.fontSize === 14));
                await enter(20);
                if (mode === 'light' && width === 390) {
                    const formatted = await page.evaluate(() => JSON.stringify(window.__typographyReview.instance.poemTextStyles));
                    await page.click(toolbar + ' .history-undo');
                    await page.waitForFunction(before => JSON.stringify(window.__typographyReview.instance.poemTextStyles) !== before, {}, formatted);
                    await page.click(toolbar + ' .history-redo');
                    await page.waitForFunction(before => JSON.stringify(window.__typographyReview.instance.poemTextStyles) === before, {}, formatted);
                }
                const saved = await page.evaluate(() => {
                    const state = window.__typographyReview.instance;
                    return { content: state.content, poemFontSize: state.poemFontSize, poemTextStyles: JSON.parse(JSON.stringify(state.poemTextStyles)) };
                });
                await page.screenshot({ path: path.join(output, `editor-${mode}-${width}.png`) });
                await page.evaluate(({ mode, saved }) => window.__typographyReview.mount('preview', mode, false, saved), { mode, saved });
                assert.equal(await page.$(toolbar), null, 'Preview has no font-size editing controls');
                const sizes = await page.$$eval('#typography-review .post-content .poem-rich-text, #typography-review .post-content .poem-rich-text [style*="font-size"]', els => els.map(el => parseFloat(getComputedStyle(el).fontSize)));
                assert.ok(sizes.some(size => size > 23 * width / 375), 'Preview retains enlarged words: ' + JSON.stringify(sizes));
                assert.ok(sizes.some(size => size < 15 * width / 375), 'Preview retains normal text');
                await page.screenshot({ path: path.join(output, `preview-${mode}-${width}.png`) });
                await page.evaluate(({ mode, saved }) => window.__typographyReview.mount('add', mode, false, saved), { mode, saved });
                await ready();
                await page.waitForFunction(() => document.querySelector('#typography-review .ql-editor [style*="24px"]'));
                if (mode === 'light' && width === 390) {
                    await select(0, 0, 0, '');
                    await page.keyboard.type('清晨，');
                    await page.waitForFunction(() => window.__typographyReview.instance.content.startsWith('清晨，'));
                    assert.ok(await page.evaluate(() => window.__typographyReview.instance.poemTextStyles.some(style => style.start === 5 && style.end === 7 && style.fontSize === 24)), 'Typing before selected words shifts their formatting');
                    await page.keyboard.press('Backspace');
                    await page.keyboard.press('Backspace');
                    await page.keyboard.press('Backspace');
                    await page.waitForFunction(() => window.__typographyReview.instance.content.startsWith('风从窗前'));
                    assert.ok(await page.evaluate(() => window.__typographyReview.instance.poemTextStyles.some(style => style.start === 2 && style.end === 4 && style.fontSize === 24)), 'Deleting the prefix preserves the original formatted range');
                }
            }
        }
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        await page.evaluate(() => window.__typographyReview.mount('add', 'light'));
        await ready();
        await select(0, 2, 4, '窗前');
        await enter(24);
        for (const name of ['bold', 'italic', 'underline', 'strike']) {
            await page.click(toolbar + ' .format-' + name);
            await page.waitForFunction(name => window.__typographyReview.instance.poemTextStyles.some(style => style.start === 2 && style.end === 4 && style[name]), {}, name);
        }
        await choose('文字颜色', 3);
        await choose('文字底色', 1);
        await choose('字距', 3);
        for (const align of ['right', 'justify', 'left', 'center']) {
            await page.click(toolbar + ' .format-align-' + align);
            await page.waitForFunction(align => document.querySelector('#typography-review .ql-editor p').style.textAlign === align, {}, align);
        }
        await choose('行距', 4);
        await choose('段前间距', 2);
        await choose('段后间距', 3);
        await page.click(toolbar + ' .format-indent');
        await page.waitForFunction(() => window.__typographyReview.instance.poemTextStyles.some(style => style.indent === 1));
        await page.click(toolbar + ' .format-outdent');
        await page.waitForFunction(() => !window.__typographyReview.instance.poemTextStyles.some(style => style.indent));
        await page.click(toolbar + ' .format-indent');
        await page.waitForFunction(() => window.__typographyReview.editor.formats.indent === 1);
        await page.click(toolbar + ' .format-painter');
        await page.waitForFunction(() => !!window.__typographyReview.editor.painter);
        await select(1, 0, 3, '把一页');
        await page.$eval('#typography-review .ql-editor', el => el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
        await page.waitForFunction(() => !window.__typographyReview.editor.painter && window.__typographyReview.instance.poemTextStyles.some(style => style.start === 7 && style.bold && style.italic && style.underline && style.strike && style.color === '#906161' && style.backgroundColor === '#f4e8b8' && style.letterSpacing === 2));
        const richSaved = await page.evaluate(() => ({ content: window.__typographyReview.instance.content, poemFontSize: 14, poemTextStyles: JSON.parse(JSON.stringify(window.__typographyReview.instance.poemTextStyles)) }));
        assert.ok(richSaved.poemTextStyles.filter(style => style.align === 'center' && style.lineHeight === 2 && style.marginTop === 8 && style.marginBottom === 12 && style.indent === 1).length === 2, 'Format painter copies paragraph settings with character formatting');
        await page.screenshot({ path: path.join(output, 'editor-rich-light-390.png') });
        await page.evaluate(saved => window.__typographyReview.mount('preview', 'light', false, saved), richSaved);
        const richView = await page.evaluate(() => {
            const span = [...document.querySelectorAll('#typography-review .poem-rich-paragraph uni-text')].find(el => el.textContent === '窗前');
            const style = getComputedStyle(span);
            const paragraph = getComputedStyle(span.parentElement);
            return { weight: style.fontWeight, slant: style.fontStyle, decoration: style.textDecorationLine, spacing: parseFloat(style.letterSpacing), align: paragraph.textAlign, before: parseFloat(paragraph.marginTop), after: parseFloat(paragraph.marginBottom) };
        });
        assert.deepEqual({ weight: richView.weight, slant: richView.slant, decoration: richView.decoration, align: richView.align }, { weight: '700', slant: 'italic', decoration: 'underline line-through', align: 'center' });
        assert.ok(richView.spacing > 1.8 && richView.before > 7 && richView.after > 11, 'Preview preserves letter and paragraph spacing');
        await page.screenshot({ path: path.join(output, 'preview-rich-light-390.png') });
        await page.evaluate(saved => window.__typographyReview.mount('add', 'dark', false, saved), richSaved);
        await ready();
        await page.waitForFunction(() => document.querySelector('#typography-review .ql-editor p').style.textAlign === 'center');
        await select(1, 0, 3, '把一页');
        await page.click(toolbar + ' .size-reset');
        await page.waitForFunction(() => window.__typographyReview.instance.poemTextStyles.some(style => style.start === 7 && style.fontSize === 14 && !style.bold && !style.color && style.letterSpacing === undefined));
        assert.ok(await page.evaluate(() => window.__typographyReview.instance.poemTextStyles.some(style => style.start === 2 && style.bold && style.color === '#906161')), 'Clearing the target keeps the source formatting');
        await page.screenshot({ path: path.join(output, 'editor-rich-dark-390.png') });
        for (const mode of ['normal', 'poem']) {
            await page.evaluate(mode => window.__typographyReview.mount('add', 'light', false, { publishMode: mode, isOriginal: false }), mode);
            await ready();
            assert.equal(await page.$('#typography-review .quote-tool-btn'), null, 'Quote insertion is specific to discussion mode');
            await select(0, 2, 4, '窗前');
            await enter(24);
            await page.click(toolbar + ' .format-bold');
            await page.waitForFunction(() => window.__typographyReview.instance.poemTextStyles.some(style => style.bold && style.fontSize === 24));
            await page.screenshot({ path: path.join(output, `editor-${mode}-390.png`) });
        }
        await page.evaluate(() => window.__typographyReview.mount('add', 'light', false, {
            publishMode: 'discussion', isDiscussion: true, blocks: [
                { type: 'content', text: '风从窗前经过\n把一页空白翻向远方' }
            ], content: '风从窗前经过\n把一页空白翻向远方'
        }));
        await ready();
        await page.click('#typography-review .quote-tool-btn');
        await page.waitForSelector('#typography-review .discussion-block.quote .ql-editor');
        await page.evaluate(() => window.__typographyReview.refreshEditors());
        await page.waitForFunction(() => window.__typographyReview.editors.length === 2 && window.__typographyReview.editors.every(editor => editor.ready));
        await page.click('#typography-review .discussion-block.quote .ql-editor');
        await page.keyboard.type('引用诗句\n另一行引用');
        await page.waitForFunction(() => window.__typographyReview.instance.blocks[1].text === '引用诗句\n另一行引用');
        assert.equal(await page.$$eval(toolbar, elements => elements.length), 2, 'Discussion body and quote have independent toolbars');
        await select(0, 2, 4, '窗前');
        await enter(24);
        await page.click('#typography-review .discussion-block.content .format-bold');
        await page.waitForFunction(() => window.__typographyReview.instance.blocks[0].poemTextStyles.some(style => style.bold));
        const firstBlockStyles = await page.evaluate(() => JSON.parse(JSON.stringify(window.__typographyReview.instance.blocks[0].poemTextStyles)));
        await select(0, 0, 2, '引用', 1);
        await enter(20, '#typography-review .discussion-block.quote .poem-typography-toolbar');
        await page.click('#typography-review .discussion-block.quote .format-italic');
        await page.waitForFunction(() => window.__typographyReview.instance.blocks[1].poemTextStyles.some(style => style.italic && style.fontSize === 20));
        assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(window.__typographyReview.instance.blocks[0].poemTextStyles))), firstBlockStyles, 'Quote editing does not alter the discussion body');
        const discussionSaved = await page.evaluate(async () => {
            const current = window.__typographyReview.instance;
            const { mergeDiscussionContent } = await import('/pages-publish/add/addPure.js');
            const sentenceGroups = current.buildDiscussionSentenceGroups();
            return { publishMode: 'discussion', isPoem: false, poemFontSize: 14, sentenceGroups, content: mergeDiscussionContent(sentenceGroups, current.content), blocks: current.buildDefaultBlocks({ sentenceGroups }) };
        });
        await page.screenshot({ path: path.join(output, 'editor-discussion-390.png') });
        await page.evaluate(saved => window.__typographyReview.mount('preview', 'light', false, saved), discussionSaved);
        assert.equal(await page.$$eval('#typography-review .discussion-preview-group', elements => elements.length), 2, 'Discussion preview retains block order');
        const discussionView = await page.$$eval('#typography-review .discussion-preview-groups uni-text', elements => elements.map(el => ({ text: el.textContent, weight: getComputedStyle(el).fontWeight, slant: getComputedStyle(el).fontStyle })));
        assert.ok(discussionView.some(item => item.text === '窗前' && item.weight === '700'));
        assert.ok(discussionView.some(item => item.text === '引用' && item.slant === 'italic'));
        await page.evaluate(saved => window.__typographyReview.mount('add', 'light', false, saved), discussionSaved);
        await ready();
        assert.ok(await page.$('#typography-review .discussion-block.quote .ql-editor em'), 'Reopening a published discussion restores quote formatting');
        await select(0, 2, 4, '窗前');
        await page.click('#typography-review .discussion-block.content .format-painter');
        await page.waitForFunction(() => !!window.__typographyReview.instance.formatPainter);
        await select(1, 0, 3, '另一行', 1);
        await page.$eval('#typography-review .discussion-block.quote .ql-editor', el => el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
        await page.waitForFunction(() => !window.__typographyReview.instance.formatPainter && window.__typographyReview.instance.blocks[1].poemTextStyles.some(style => style.start === 5 && style.bold && style.fontSize === 24));
        for (const mode of ['light', 'dark']) {
            await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
            await page.evaluate(mode => window.__typographyReview.mount('add', mode, false, {
                publishMode: 'discussion', isDiscussion: true, blocks: [
                    { type: 'content', text: '风从窗前经过\n把一页空白翻向远方' },
                    { type: 'content', text: '讨论的另一段正文' }
                ]
            }), mode);
            await ready();
            await page.click('#typography-review #discussion-block-0 .discussion-insert-anchor .icon-btn');
            await page.waitForSelector('#typography-review .discussion-insert-menu');
            await page.click('#typography-review .discussion-insert-option:last-child');
            await page.waitForFunction(() => window.__typographyReview.instance.blocks.length === 3);
            assert.deepEqual(await page.evaluate(() => window.__typographyReview.instance.blocks.map(block => block.type)), ['content', 'quote', 'content'], 'The paragraph menu inserts a quote at the selected position');
            assert.equal(await page.$eval('#typography-review .quote-tool-btn', el => el.textContent.trim()), '', 'The quote shortcut uses only its icon');
            await page.click('#typography-review .quote-tool-btn');
            await page.waitForFunction(() => {
                const viewport = document.querySelector('#typography-review .block-scroll').getBoundingClientRect();
                const quote = document.querySelector('#typography-review #discussion-block-3 .discussion-block-header')?.getBoundingClientRect();
                const editor = document.querySelector('#typography-review #discussion-block-3 .poem-native-editor')?.getBoundingClientRect();
                return quote && editor && quote.top >= viewport.top - 1 && editor.bottom <= viewport.bottom + 1;
            });
            assert.deepEqual(await page.evaluate(() => window.__typographyReview.instance.blocks.map(block => block.type)), ['content', 'quote', 'content', 'quote'], 'The paragraph menu inserts a quote at the selected position');
            assert.equal(await page.evaluate(() => window.__typographyReview.instance.blocks[2].text), '讨论的另一段正文', 'Inserting a quote retains the following body block');
            await page.screenshot({ path: path.join(output, `discussion-insert-${mode}-320.png`) });
        }
        for (const [width, height] of [[320, 568], [390, 568], [320, 480], [390, 480]]) {
            await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
            await page.evaluate(() => window.__typographyReview.mount('add', 'light', false, {
                content: '风从窗前经过\n' + Array.from({ length: 36 }, (_, index) => `第${index + 1}行，月光落在纸上`).join('\n') + '\n最后一行仍然清晰', poemTextStyles: []
            }));
            await ready();
            await page.$eval('#typography-review .ql-editor', el => { el.scrollTop = el.scrollHeight; });
            const layout = await page.evaluate(() => {
                const rect = selector => {
                    const value = document.querySelector('#typography-review ' + selector).getBoundingClientRect();
                    return { top: value.top, bottom: value.bottom, height: value.height };
                };
                return { editor: rect('.ql-editor'), lastLine: rect('.ql-editor p:last-child'), note: rect('.editor-footnote'), back: rect('.back-icon'), next: rect('.floating-action-btn'), footer: rect('.compose-actions'), sideBottom: Math.max(...[...document.querySelectorAll('#typography-review .side-tool-icon')].map(el => el.getBoundingClientRect().bottom)) };
            });
            assert.ok(layout.lastLine.top >= layout.editor.top && layout.lastLine.bottom <= layout.editor.bottom + 1, `${width}: the last line scrolls fully into view`);
            assert.ok(Math.min(layout.back.top, layout.next.top) >= layout.note.bottom + 4, `${width}x${height}: bottom actions do not cover the editor or its counter: ${JSON.stringify(layout)}`);
            assert.ok(layout.sideBottom <= layout.footer.top, `${width}x${height}: side tools stay clear of the bottom actions: ${JSON.stringify(layout)}`);
            await page.screenshot({ path: path.join(output, `editor-short-${width}-${height}.png`) });
        }
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        await page.evaluate(() => window.__typographyReview.mount('add', 'light', true));
        await ready();
        await select(0, 2, 4, '窗前');
        const input = await page.$(toolbar + ' input');
        await input.focus(); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
        await page.keyboard.press('Backspace'); await input.type('24'); await page.keyboard.press('Enter');
        await page.waitForFunction(() => window.__typographyReview.instance.seriesBlocks[0].poemTextStyles?.length === 1);
        assert.ok(!await page.evaluate(() => window.__typographyReview.instance.seriesBlocks[1].poemTextStyles?.length), 'Other series poems are unchanged');
        await page.screenshot({ path: path.join(output, 'series-light-390.png') });
        await page.evaluate(() => window.__typographyReview.mount('detail', 'light'));
        assert.equal(await page.$eval('#typography-review .post-detail-page', el => el.id), 'review-post-detail', 'Route id is bound to the detail page root');
        assert.equal(await page.$$eval('#typography-review [id="review-post-detail"]', elements => elements.length), 1, 'Overlay host does not inherit the page id');
        await page.evaluate(() => window.__typographyReview.instance.isLoading = false);
        assert.equal(await page.$eval('#typography-review .post-detail-page', el => el.getAttribute('data-review-page')), 'detail');
        assert.deepEqual(attributeWarnings, [], 'Detail updates do not emit fragment attribute warnings');
        console.log('Poem selection H5: selection formatting, typography tools, discussion quote insertion and scrolling, independent body/quote formats, cross-block painter, light/dark, draft restoration, preview, series formatting and detail route attributes passed.');
        console.log(`Screenshots: ${output}`);
    } catch (error) {
        if (page) await page.screenshot({ path: path.join(output, 'failure.png') });
        throw error;
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
