// 运行时 env 必填 helper。ADR-0019 禁 env 默认值兜底。
// 语义镜像 nextjs src/lib/env-required.ts；空串 "" 视为「显式设空」不抛。
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined) {
    throw new Error(
      `${name} env is required (ADR-0019 禁字面默认值). ` +
        `Set via .env (dev) or GitHub Secrets → ci.yml envs (prod).`,
    );
  }
  return v;
}
