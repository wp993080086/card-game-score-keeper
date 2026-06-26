/** @description 任意类型*/
declare type TAny = any

/** @description 对象字典*/
declare type TDict<T = TAny> = { [key: string]: T }

/** @description 任意函数*/
declare type TFunc<T = TAny> = (...args: T[]) => T
