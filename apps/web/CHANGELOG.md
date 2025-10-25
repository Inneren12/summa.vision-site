# Changelog

## [0.1.2](https://github.com/Inneren12/summa.vision-site/compare/summa-web-v0.1.1...summa-web-v0.1.2) (2025-10-25)


### Features

* add correlated client error boundary ([48c4a2d](https://github.com/Inneren12/summa.vision-site/commit/48c4a2d6f2f0cae895376272e404c20054d8a73e))
* add correlated client error boundary ([1b8948e](https://github.com/Inneren12/summa.vision-site/commit/1b8948ead76555234c79d4fa298abbd0805496f6))
* add in-memory feature flag runtime ([04c0bbb](https://github.com/Inneren12/summa.vision-site/commit/04c0bbbd3f77dc9d3acc59676bde3fd140206b94))
* add memory feature flag runtime with telemetry ([19d07b2](https://github.com/Inneren12/summa.vision-site/commit/19d07b2e7e911e24cca83292f02e4f3c2b8d0727))
* add scrolly step controller hook ([6c81caa](https://github.com/Inneren12/summa.vision-site/commit/6c81caa1622b526e048bef5bc0c2541534da0de0))
* add scrolly step controller hook ([66a8e85](https://github.com/Inneren12/summa.vision-site/commit/66a8e85b2d147bdee36f585b4c91e8ade2d43f85))
* add scrollytelling story shell ([b26da0c](https://github.com/Inneren12/summa.vision-site/commit/b26da0c29e43a3fd8df99c6d8ecff09ce026b45c))
* add standalone visual snapshot setup ([f71dfd4](https://github.com/Inneren12/summa.vision-site/commit/f71dfd4e34da0fe923b2e1299fdb767987e8409d))
* add standalone visual snapshot setup ([81b27b7](https://github.com/Inneren12/summa.vision-site/commit/81b27b7ff6999633a6018567d2b4742523808a3b))
* batch client telemetry events ([23694bf](https://github.com/Inneren12/summa.vision-site/commit/23694bf50a7b91d31ef3072346a2495a849c8f28))
* batch client telemetry events ([119c3f1](https://github.com/Inneren12/summa.vision-site/commit/119c3f1bfa87d23f09dcf05f238d7928d2ecbe11))
* capture snapshot headers for vitals and error metrics ([70b9a06](https://github.com/Inneren12/summa.vision-site/commit/70b9a064ade6a0a108ab1b2c66da25787956a943))
* configure ISR and healthz caching ([74aecbe](https://github.com/Inneren12/summa.vision-site/commit/74aecbe68b53cbe586be7983d04753669b04dbc4))
* configure ISR and healthz caching ([645c2dc](https://github.com/Inneren12/summa.vision-site/commit/645c2dc230f9f20f0cd2b7377ade058efd8b4cc9))
* forward snapshot headers to vitals collection ([c2eab17](https://github.com/Inneren12/summa.vision-site/commit/c2eab17ade1a7b52926014b9a5c10b56c0391022))
* lazily mount story visualizations ([d22db46](https://github.com/Inneren12/summa.vision-site/commit/d22db46dfdba7cc70a1ac43ada6519f3965a5ddb))
* lazily mount story visualizations ([f79c345](https://github.com/Inneren12/summa.vision-site/commit/f79c3450c2eda2008ea3bb5025e3da0abb23607d))
* respect prefers-reduced-motion in stories ([6f4bcfc](https://github.com/Inneren12/summa.vision-site/commit/6f4bcfca5f04daa4a8de8143dee65eab5d3e9537))
* respect prefers-reduced-motion in stories ([f91c88e](https://github.com/Inneren12/summa.vision-site/commit/f91c88eebd9431e738593a165835b19199ace4a5))
* **web:** add scrolly binding hook ([ab96fca](https://github.com/Inneren12/summa.vision-site/commit/ab96fca3caf08e43e6675555b9c298b0e3651513))
* **web:** add scrolly binding hook ([88b084d](https://github.com/Inneren12/summa.vision-site/commit/88b084d592239d17a30ea6824a6ca1c9ffdea914))
* **web:** sync story steps with URL deep links ([13d7846](https://github.com/Inneren12/summa.vision-site/commit/13d78462312ac803d8a609ca09ec0ff69b4d249d))
* **web:** sync story steps with URL deep links ([acaf33a](https://github.com/Inneren12/summa.vision-site/commit/acaf33a764dd6f46cef3042b2b0e8aba9f4f8229))


### Bug Fixes

* capture optional vitals fields safely ([5cd10bb](https://github.com/Inneren12/summa.vision-site/commit/5cd10bbed7c6246f582f3a8cb1eff3368bb71b99))
* restore healthz status field ([8db19a4](https://github.com/Inneren12/summa.vision-site/commit/8db19a43853ecd23f69a86bf391ee72ffe357ac0))
* **scrolly:** ensure nextActiveStepId is non-null when calling onStepChange ([32c4360](https://github.com/Inneren12/summa.vision-site/commit/32c4360a48cd6b8ecea360852fc4f5417ceb5bb1))
* stabilize story e2e tests ([a948b06](https://github.com/Inneren12/summa.vision-site/commit/a948b06d7b238d6b49837519417de1867c38831d))
* **web:** coerce componentStack null to undefined in error reporter ([cca054a](https://github.com/Inneren12/summa.vision-site/commit/cca054ad28a45496a55e7d2843488a0e96a68f1c))
* **web:** providers.tsx uses relative correlation import (TS types OK) ([62687dd](https://github.com/Inneren12/summa.vision-site/commit/62687ddd12a8ad0e4ab7a8257050e307cf7b932b))

## [0.1.1](https://github.com/Inneren12/summa.vision-site/compare/summa-web-v0.1.0...summa-web-v0.1.1) (2025-10-22)

### Features

- add security headers and sentry integration ([e9e82ed](https://github.com/Inneren12/summa.vision-site/commit/e9e82edc0e5ca5d339cbd02121be711b13e1dc9d))
- add theming atoms and storybook docs ([7a5814e](https://github.com/Inneren12/summa.vision-site/commit/7a5814e36e94fabb518db47cd8df5f797210dbf3))
- bootstrap web workspace and tooling ([72c7d97](https://github.com/Inneren12/summa.vision-site/commit/72c7d97d0a32ed9398b9b02f1d424f58b8ec7c87))
- improve app layout accessibility and config coverage ([fee5af7](https://github.com/Inneren12/summa.vision-site/commit/fee5af7afa8377ec700694760238683cbc25f3b7))
- validate web env vars and tighten quality guardrails ([add7ee5](https://github.com/Inneren12/summa.vision-site/commit/add7ee51a340231ca95f1c48865ccf852082386c))
