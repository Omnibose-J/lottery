# Lottery

1~45 중 6개 번호를 뽑는 단일 HTML 로또 추첨기입니다.

- Live: https://lotto-practice.vercel.app
- Supabase `lotto_draw`에 추첨 기록을 저장합니다 (쓰기: Vercel `/api/save-draws`, 읽기: anon SELECT).
- 공식 당첨번호: `/api/lotto-latest` (동행복권 프록시)
- 분석: GA4 `G-BHJCDFF8CY` (동의 후에만 로드)

## 실행

로컬에서는 `index.html`을 정적 서버로 열면 UI는 보이지만, 저장·최신 당첨번호 API는 Vercel 배포 환경(또는 `vercel dev`)이 필요합니다.

```bash
npx serve .
# 또는
vercel dev
```

## Supabase

- 연결 프로젝트: `localsync` (`uuqpsswvpebtawpcgvaa`)
- 테이블: `public.lotto_draw`
- 마이그레이션: `supabase/migrations/`
- anon INSERT는 비활성. `SUPABASE_SERVICE_ROLE_KEY`는 Vercel 환경변수에만 둡니다.

## 검증

```bash
node scripts/smoke.mjs https://lotto-practice.vercel.app
```
