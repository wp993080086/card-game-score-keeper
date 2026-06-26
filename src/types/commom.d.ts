// 任意类型

declare type TAny = any

// 对象字典
declare type TDict<T = TAny> = { [key: string]: T }

// 任意函数
declare type TFunc<T = TAny> = (...args: T[]) => T
