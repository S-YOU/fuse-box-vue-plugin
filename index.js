"use strict";
const fs = require('fs')
const path = require('path')
Object.defineProperty(exports, "__esModule", { value: true });
let vueCompiler;
let vueTranspiler;
class VuePluginClass {
    constructor(options = {}) {
        this.options = options;
        this.test = /\.vue$/;
    }
    init(context) {
        context.allowExtension(".vue");
        this.context = context
    }
    transform(file) {
        const context = file.context;
        if (context.useCache) {
            let cached = context.cache.getStaticCache(file);
            if (cached) {
                file.isLoaded = true;
                if (cached.sourceMap) {
                    file.sourceMap = cached.sourceMap;
                }
                file.analysis.skip();
                file.analysis.dependencies = cached.dependencies;
                file.contents = cached.contents;
                return;
            }
        }
        file.loadContents();
        if (!vueCompiler) {
            vueCompiler = require("vue-template-compiler");
            vueTranspiler = require("vue-template-es2015-compiler");
        }
        let result = vueCompiler.parseComponent(file.contents, this.options);
        if (result.template && result.template.type === "template") {
            let templateLang = (result.template.attrs) ? result.template.attrs.lang : null;
            if (result.template.src) {
                result.template.content = fs.readFileSync(path.join(file.info.absDir, result.template.src)).toString()
            }
            return compileTemplateContent(context, templateLang, result.template.content).then(html => {
                let compiled = vueCompiler.compile(html);
                file.contents = result.script.content
                if (this.options.js) {
                    this.options.js.handleBabelRc.call(this)
                    this.options.js.transform.call(this, file)
                }
                let combinedResult = `var _p = {};
var _v = function(exports){${file.contents}
};
_p.render = ` + toFunction(compiled.render) + `
_p.staticRenderFns = [ ` + compiled.staticRenderFns.map(toFunction).join(',') + ` ];
var _e = {}; _v(_e); _p = Object.assign(_e.default, _p)
module.exports =_p
                `;
                file.contents = combinedResult;
                if (context.useCache) {
                    context.emitJavascriptHotReload(file);
                    context.cache.writeStaticCache(file, file.sourceMap);
                }
                return true;
            }).catch(err => {
                console.error(err);
            });

        }
    }
}
exports.VuePluginClass = VuePluginClass;
;
function toFunction(code) {
    return vueTranspiler('function render () {' + code + '}');
}
function compileTemplateContent(context, engine, content) {
    return new Promise((resolve, reject) => {
        if (!engine) {
            return resolve(content);
        }
        const cons = require('consolidate');
        if (!cons[engine]) {
            return content;
        }
        cons[engine].render(content, {
            filename: 'base',
            basedir: context.homeDir,
            includeDir: context.homeDir
        }, (err, html) => {
            if (err) {
                return reject(err);
            }
            resolve(html);
        });
    });
}
module.exports = (options) => {
    return new VuePluginClass(options);
};

