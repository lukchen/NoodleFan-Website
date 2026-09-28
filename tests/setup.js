// Edge Function 的代码跑在 Deno 里,模块顶层会读 Deno.env(比如 email.ts 的 OPS_EMAIL)。
// 在 Node 里跑同一份文件,得先把这个全局垫上,否则 import 阶段就抛错。
// 故意返回 undefined —— 让被测代码走它自己的默认值分支,那正是线上没设 secret 时的行为。
globalThis.Deno = { env: { get: () => undefined } }
