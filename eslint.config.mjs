// 提供一组预定义的全局变量（如 window、document 等) 用来指定代码所运行的环境
import globals from 'globals'
// 针对 JavaScript 的 ESLint 配置和规则。保持 JavaScript 代码的一致性和质量
import pluginJs from '@eslint/js'
// 提供了对 TypeScript 的支持
import tseslint from 'typescript-eslint'
// 提供了 Vue 特有 ESLint 规则
import pluginVue from 'eslint-plugin-vue'
// 将 Prettier 的格式化规则整合到 ESLint 中,让 Prettier 的错误直接显示在 IDE 红线上,自动关闭所有与格式相关的 ESLint 规则
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

/** @description ESLint 负责逻辑质量 */
/** @type {import('eslint').Linter.Config[]} */
export default [
	// 忽略文件
	{
		ignores: [
			'dist/',
			'.history/',
			'public/',
			'.vscode/',
			'node_modules/',
			'scripts/',
			'postcss.config.js',
			'thinkingData/',
			'**/*min.js',
			'**/*min.d.ts',
			'*.md',
			'*.scss',
			'*.woff',
			'*.ttf',
			'mock',
			'bin',
			'build',
			'config',
			'dist_test',
			'dist_mock',
			'dist_development',
			'dist_production',
			'src/uni_modules'
		]
	},
	// 指定了哪些文件类型将应用这些规则
	{ files: ['**/*.{js,ts,jsx,tsx,vue}'] },
	// 配置了浏览器环境下的全局变量
	{ languageOptions: { globals: globals.browser } },
	/**
	 * @description 基础配置
	 */
	// 插件和规则
	pluginJs.configs.recommended,
	// 引入 `typescript-eslint` 插件的推荐规则
	...tseslint.configs.recommended,
	// 引入`eslint-plugin-vue` 插件的推荐规则
	...pluginVue.configs['flat/recommended'],
	// 引入 `eslint-plugin-vue` 插件的必要规则
	...pluginVue.configs['flat/essential'],
	/**
	 * @description 集成 prettier 配置;
	 * @description 会合并根目录下的.prettier.config.js 文件;
	 * @description 这行必须放在最后！它会关闭上面（基础配置）所有可能与 Prettier 冲突的 ESLint 规则;
	 * @see https://prettier.io/docs/en/options
	 */
	eslintPluginPrettierRecommended,
	// 消除版本警告
	{
		settings: {
			react: {
				version: 'detect'
			}
		}
	},
	// 配置 Vue 文件的 TypeScript 解析器
	{
		files: ['**/*.vue'],
		languageOptions: {
			parserOptions: {
				// Vue 文件中的 TypeScript 代码使用 TypeScript 解析器
				parser: tseslint.parser,
				// 指定 tsconfig.json 文件路径，让 ESLint 能正确读取类型定义
				project: './tsconfig.json',
				// 添加 .vue 扩展名支持
				extraFileExtensions: ['.vue']
			}
		}
	},
	/**
	 * @description 自定义规则;
	 * @description 只保留逻辑类规则，所有格式类规则应该交给 prettier 插件处理;
	 */
	{
		rules: {
			/**
			 * @description 代码质量与最佳实践 (建议/错误)
			 */
			'no-var': 'error', // 禁用 var，用 let 和 const 代替
			eqeqeq: 'error', // 必须使用全等 (===)
			'no-eq-null': 'error', // 禁止对 null 使用 == 或 != 运算符
			'default-case': 'error', // switch 语句最后必须有 default
			'prefer-const': 'warn', // 首选 const（若变量未被重新赋值）
			/**
			 * @description 逻辑开关与环境适配 (关闭检查/允许特定行为)
			 */
			'no-undef': 'off', // （禁止使用未定义的变量）TypeScript 已有类型检查，所以关闭 ESLint 的 no-undef 避免全局类型报错
			'no-console': 'off', // 允许使用 console (Vite build 已经处理了 console，这里关掉方便开发)
			'no-unused-vars': 'off', // 允许出现未使用过的变量 (JS基础规则，已由下方的 TS 规则接管)
			'no-use-before-define': 'off', // 允许在变量定义之前使用它们
			'no-unreachable': 'off', // 允许在 return、throw、continue 和 break 语句之后出现代码
			'no-case-declarations': 'off', // 允许在 case 子句中使用词法声明 (如 let/const)
			'no-constant-condition': 'off', // 允许在条件中使用常量表达式 (如 while(true))
			'no-useless-escape': 'off', // 允许不必要的转义 (有时为了正则可读性)
			'no-control-regex': 'off', // 允许正则中使用控制字符
			'no-sparse-arrays': 'off', // 允许稀疏数组 (如 [1, , 3])
			'no-prototype-builtins': 'off', // 允许直接调用 Object.prototype 的方法
			'no-async-promise-executor': 'off', // 允许在 Promise 构造函数中使用 async 函数
			/**
			 * @description TypeScript 专用规则 (替代基础规则，提供更精确的类型检查)
			 */
			'@typescript-eslint/no-unused-vars': 'off', // 关闭未使用变量检查（开发阶段方便调试）
			'@typescript-eslint/no-explicit-any': 'off', // 允许使用 any 类型（逐步迁移到严格类型）
			'@typescript-eslint/no-empty-function': 'off', // 允许空函数（如占位符）
			'@typescript-eslint/ban-ts-comment': 'off', // 允许使用 @ts-ignore 等注释
			'@typescript-eslint/no-empty-object-type': 'off', // 允许使用 {}
			'@typescript-eslint/no-unsafe-function-type': 'off', // 允许使用 Function 类型
			'@typescript-eslint/no-wrapper-object-types': 'off', // 允许使用 String/Number/Boolean 包装类型
			'@typescript-eslint/no-unused-expressions': 'off', // 允许未使用的表达式
			'@typescript-eslint/no-require-imports': 'off', // 允许使用 require
			'@typescript-eslint/no-this-alias': 'off', // 允许给 this 起别名
			'@typescript-eslint/no-non-null-assertion': 'off', // 允许使用非空断言 !
			'@typescript-eslint/no-duplicate-enum-values': 'off', // 允许枚举中有重复值
			'@typescript-eslint/no-namespace': 'off', // 允许使用 namespace
			'@typescript-eslint/triple-slash-reference': 'off', // 允许使用三斜线指令
			'@typescript-eslint/consistent-type-imports': 'off', // 允许使用 import type
			'@typescript-eslint/prefer-namespace-keyword': 'off', // 不强制使用 namespace 关键字
			'@typescript-eslint/no-unnecessary-type-constraint': 'off', // 允许不必要的类型约束
			'@typescript-eslint/no-non-null-asserted-optional-chain': 'off', // 允许在可选链后使用非空断言
			'@typescript-eslint/no-misused-promises': 'off', // 允许 Promise 的误用（如将 Promise 传给非 Promise 参数）
			'@typescript-eslint/no-unsafe-argument': 'off', // 允许不安全的参数传递
			'@typescript-eslint/no-unsafe-assignment': 'off', // 允许不安全的赋值
			'@typescript-eslint/no-unsafe-member-access': 'off', // 允许不安全的成员访问
			'@typescript-eslint/no-unsafe-return': 'off', // 允许不安全的返回值
			'@typescript-eslint/no-unsafe-call': 'off', // 允许不安全的函数调用
			'@typescript-eslint/only-throw-error': 'off', // 允许抛出非 Error 对象
			'@typescript-eslint/prefer-promise-reject-errors': 'off', // 允许 reject 非 Error 对象
			'@typescript-eslint/unbound-method': 'off', // 允许未绑定的方法引用
			'@typescript-eslint/no-duplicate-type-constituents': 'off', // 允许重复的类型成分
			'@typescript-eslint/no-redundant-type-constituents': 'off', // 允许冗余的类型成分
			'@typescript-eslint/no-floating-promises': 'off', // 允许未处理的 Promise
			'@typescript-eslint/await-thenable': 'off', // 允许 await 非 Thenable 对象
			'@typescript-eslint/restrict-template-expressions': 'off', // 允许在模板字符串中使用任意类型
			'@typescript-eslint/restrict-plus-operands': 'off', // 允许 + 运算符操作任意类型
			'@typescript-eslint/no-base-to-string': 'off', // 允许将对象转为字符串
			'@typescript-eslint/use-unknown-in-catch-callback-variable': 'off', // 允许 catch 回调中使用 any
			/**
			 * @description Vue 专用规则
			 */
			'vue/multi-word-component-names': 'off', // 允许多词组件名（如 index.vue）
			'vue/no-mutating-props': 'off', // 允许修改 props（某些场景需要）
			'vue/no-v-model-argument': 'off', // 允许 v-model 带参数
			'vue/no-v-for-template-key': 'off', // 允许在 template 上使用 key
			'vue/no-v-text-v-html-on-component': 'off', // 允许在组件上使用 v-text/v-html
			'vue/no-reserved-component-names': 'off', // 允许使用保留的组件名
			'vue/no-useless-template-attributes': 'off', // 允许无用的 template 属性
			'vue/valid-v-for': 'off', // 允许无效的 v-for（某些动态场景）
			'vue/require-v-for-key': 'off', // 允许 v-for 不带 key
			'vue/no-unused-vars': 'off', // 允许未使用的变量
			'vue/no-parsing-error': 'off', // 允许解析错误（某些模板语法）
			'vue/no-template-key': 'off', // 允许 template 上的 key
			'vue/no-deprecated-v-on-native-modifier': 'off', // 允许使用已废弃的 .native 修饰符
			'vue/require-default-prop': 'off', // 允许 prop 没有默认值
			'vue/require-prop-types': 'off', // 允许 prop 没有类型定义
			'vue/no-setup-props-destructure': 'off', // 允许解构 props
			'vue/no-ref-as-operand': 'off', // 允许 ref 作为操作数
			'vue/no-deprecated-destroyed-lifecycle': 'off', // 允许使用已废弃的生命周期
			'vue/no-deprecated-dollar-listeners-api': 'off', // 允许使用已废弃的 $listeners
			'vue/no-deprecated-dollar-scopedslots-api': 'off', // 允许使用已废弃的 $scopedSlots
			'vue/no-deprecated-events-api': 'off', // 允许使用已废弃的事件 API
			'vue/no-deprecated-functional-template': 'off', // 允许使用已废弃的 functional 模板
			'vue/no-deprecated-filter': 'off', // 允许使用已废弃的 filter
			'vue/no-deprecated-inline-template': 'off', // 允许使用已废弃的 inline-template
			'vue/no-deprecated-v-bind-sync': 'off', // 允许使用已废弃的 .sync
			'vue/no-deprecated-v-is': 'off', // 允许使用已废弃的 v-is
			'vue/no-deprecated-vue-config-keycodes': 'off', // 允许使用已废弃的 keyCodes
			'vue/valid-attribute-name': 'off', // 允许无效的属性名
			'vue/valid-model-definition': 'off', // 允许无效的 model 定义
			'vue/valid-template-root': 'off', // 允许无效的模板根元素
			'vue/comment-directive': 'off', // 允许注释指令
			'vue/jsx-uses-vars': 'off', // 允许 JSX 中使用未声明的变量
			'vue/no-side-effects-in-computed-properties': 'off', // 允许在计算属性中产生副作用
			'vue/no-async-in-computed-properties': 'off', // 允许在计算属性中使用异步
			'vue/return-in-computed-property': 'off', // 允许计算属性没有返回值
			'vue/no-textarea-mustache': 'off', // 允许在 textarea 中使用 mustache
			'vue/no-unused-components': 'off', // 允许未使用的组件
			'vue/no-v-for-template-key-on-child': 'off', // 允许在子元素上使用 key
			'vue/no-v-if-v-for': 'off', // 允许 v-if 和 v-for 同时使用
			'vue/no-multiple-template-root': 'off', // 允许多个根元素
			'vue/attribute-hyphenation': 'off', // 允许不使用连字符属性名
			'vue/singleline-html-element-content-newline': 'off', // 允许单行元素内容不换行
			'vue/multiline-html-element-content-newline': 'off', // 允许多行元素内容不换行
			'vue/html-self-closing': 'off', // 允许自闭合标签
			'vue/html-indent': 'off', // 允许任意缩进
			'vue/html-closing-bracket-newline': 'off', // 允许闭合括号不换行
			'vue/html-closing-bracket-spacing': 'off', // 允许闭合括号任意空格
			'vue/html-end-tags': 'off', // 允许不闭合标签
			'vue/html-quotes': 'off' // 允许任意引号
		}
	}
]
