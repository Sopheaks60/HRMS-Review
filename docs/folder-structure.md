# Full folder structure

```
KromPay/
├── apps/
│   ├── api/                         # NestJS
│   │   ├── src/common/{decorators,filters,guards,interceptors}
│   │   ├── src/modules/{auth,tenants,rbac,users,employees,organization,
│   │   │     attendance,biometric,leave,overtime,payroll,recruitment,
│   │   │     performance,lms,expenses,assets,analytics,notifications,
│   │   │     audit,billing,files,health}
│   │   ├── src/prisma
│   │   └── test
│   ├── web/                         # Nuxt 4
│   │   ├── pages/{ess,hr,attendance,leave,payroll,recruitment,
│   │   │     performance,lms,expenses,assets,settings,billing}
│   │   ├── layouts, stores, composables, i18n/locales/{en,km}.json
│   │   └── middleware
│   └── mobile/                      # Flutter
│       └── lib/{core,features/{auth,attendance,leave,payslip,ess}}
├── packages/
│   ├── prisma/{schema.prisma,migrations/0001_init,seed}
│   └── shared/src/{payroll,rbac,events}
├── openapi/krompay.yaml
├── infra/{docker,k8s/base,k8s/overlays/{dev,prod}}
├── docs/{architecture,payroll-cambodia,security,deployment,runbook}
├── tests/{e2e,unit,load}
└── .github/workflows/ci.yml
```
