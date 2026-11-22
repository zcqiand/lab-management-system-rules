// tests/setup-env.ts — 仅测试进程注入家族 dev env 值。
// 这是测试基建注入，不是 prod env 兜底：app/server 运行面仍 requireEnv fail-fast。
// 值 = 家族 PG dev 面（families/lab.md：postgres/postgres@127.0.0.1:54321/lab_test）。
process.env.SERVER_PORT ??= "5214";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:54321/lab_test";
process.env.LAB_CORS_ALLOWED_ORIGINS ??= "http://localhost:5214";
process.env.SAAS_IDP_URL ??= "http://localhost:5101";
process.env.LAB_SAAS_SERVICE_USER ??= "alice";
process.env.LAB_SAAS_SERVICE_PASSWORD ??= "dev123456";
process.env.LAB_SAAS_SERVICE_CLIENT_ID ??= "lab-management";
process.env.LAB_SAAS_CLIENT_ID ??= "lab-management";
process.env.LAB_JWT_SECRET ??= "rules-test-secret-0123456789abcdef-32bytes!";
process.env.LAB_JWT_ISSUER ??= "lab-rules-test";
process.env.LAB_JWT_TTL_SECONDS ??= "3600";
