# V2 — pokretanje i provera

## Isporučene promene

Direktni Greenhouse/Lever/Ashby adapteri koriste postojeći `atsBoardUrls`, `sourcesEnabled`, progress i collector history. Nema nove baze, layout-a niti kopiranog projekta. Direct ATS ide pre Remotive/Arbeitnow, zatim samo eksplicitno izabrani Apify/LinkedIn/regionalni izvori. Novi profili ne uključuju plaćene izvore; postojeći eksplicitni izbor ostaje sačuvan. Kada board promeni ATS ili nestane, greška ostaje u `collector_runs`; ostali board-ovi nastavljaju.

Dedup koristi source ID ili isti canonical URL. Dva različita requisition URL-a istog naslova ostaju odvojena. Persistence prepoznaje isti URL sa istim naslovom, ili potpuno isti originalni URL i promenjen naslov; zadržava postojeći job ID i istoriju prijave. To nije puni cross-source alias katalog. Concurrent upsert, prepoznavanje preusmerenih URL-ova i zatvaranje nestalih poslova ostaju sledeća migraciona faza.

AI cache sada uključuje opis i relevantna polja oglasa, profil, kriterijume/verziju, model i prompt. Pipeline ocenjuje oglase koji su preživeli ovaj prolaz i objavljuje samo uspešno ocenjene/cache rezultate iz tog prolaza. Opportunity je odvojen signal kvaliteta oglasa, sa navedenim komponentama i nepoznatim podacima. Čuva se u `scoreJson`, a MCP detalj ga računa za trenutni datum. Nije prognoza odgovora poslodavca; postojeći UI i match score ostaju.

CV i letter provera odbija nepodržane numeričke tvrdnje; grounding neuspeh blokira odobravanje. Pri odobravanju se ponovo proverava uređeni sadržaj prema aktuelnom odobrenom profilu. Ovo je deterministička provera poznatih obrazaca, ne dokaz svake semantičke tvrdnje. Postojeći outcome eventi i application board su sačuvani.

## Provere

- Cela `pnpm test` suita prolazi; dodatni V2 testovi pokrivaju tri adaptera, HTTP greške/cooldown, izbor izvora, dedup, hard remote filter, limit, cache invalidation, CV metrike, worker lock i MCP lifecycle/stdio.
- `pnpm exec tsc --noEmit` prolazi.
- Production build prolazi uz mrežni pristup za postojeće Google fontove. Jedan ponovljeni build je pao na Turbopack font kešu; čist build posle uklanjanja generisanog `.next` direktorijuma je prošao.
- Lint izmenjenih/dodatih fajlova prolazi. Globalni lint ima 19 grešaka i 6 upozorenja u postojećem kodu; svih 19 grešaka je u neizmenjenim fajlovima (React effects u komponentama i `prefer-const` u mail sync-u). Ovo ostaje zabeležen postojeći dug, ne prolaz celog lint-a.
- Live javni smoke 2026-09-29: Greenhouse/Figma 162 oglasa sa opisima; Ashby/Linear 30; Lever/Palantir 318. Lever/lever vratio je validnu praznu listu; Netflix board 404. To pokazuje i zašto greška jednog board-a ne sme oboriti ceo prolaz.
- FreeHire je vratio HTTP 200 sa `data/meta` envelope i job poljima. Nije dodat kao produkcijski adapter; pre uključivanja proveriti rate limits, atribuciju, kompletan filter/pagination contract i marginalnu relevantnost. JobSpy ostaje neinstaliran opcioni fallback.

## Lokalno pokretanje

Iz root-a repozitorijuma, nakon standardnog setup-a i konfiguracije Neon `DATABASE_URL`:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec tsc --noEmit
pnpm build
node --import tsx scripts/jobs-sources-smoke.ts
pnpm jobs:worker
```

Smoke radi samo javne GET zahteve, bez aplikacione baze i bez AI troška. `jobs:worker` zahteva odobren profil/kriterijume i postojeću AI konfiguraciju; može potrošiti podešeni AI/Apify budžet. Pokreće samo job pipeline. Originalni `worker` i dalje ima širi company/outreach obuhvat.

Zakazivanje na jednom host-u: pozivati `jobs:worker` iz postojećeg scheduler-a, sa radnim direktorijumom ovog projekta, npr. jednom dnevno u 09:00 Europe/Belgrade. Nije instaliran OS raspored. `data/jobs-worker.lock` sprečava preklapanje dva CLI worker procesa. Pri normalnom izlazu/grešci se uklanja; posle nasilnog prekida ostaje. Pre ručnog uklanjanja proveriti da PID iz lock-a više ne radi. Lock nije distribuiran i ne zaključava web pretrage; za više instanci/Vercel cron potreban je PostgreSQL lease. Ne zakazivati paralelno sa starim worker-om ili ručnim Find Jobs tokom prvog pilota.

## MCP

```sh
node --import tsx scripts/jobs-mcp.ts
```

Klijent pokreće ovu komandu sa cwd=root repozitorijuma i lokalnom `.env` konfiguracijom. Koristiti direktan `node`, bez package-manager banner-a na stdout. Ako klijent nema cwd opciju, postaviti zasebnu lokalnu wrapper komandu koja ulazi u root i koristi `exec node --import tsx scripts/jobs-mcp.ts`.

Protokol: MCP 2025-06-18, JSON-RPC newline stdio. `initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `ping`. Alati: `list_jobs` (limit 1–50), `get_job` (jedan interni ID). Nema alata za slanje, brisanje, menjanje stanja, CV ili profile. Detalj vraća poslednju zabeleženu match ocenu sa datumom, koja može biti istorijska; opis oglasa je nepoverljiv sadržaj. MCP se ne registruje automatski u klijentu i nema otvoren HTTP port. [Protokol](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports).

## Deployment gate i rollback

U ovom checkout-u nisu dostavljeni DATABASE_URL i AI kredencijali. Nisu izvršeni DB migration, end-to-end Find Jobs, plaćeni AI pozivi, slanje mejla niti stvarne prijave. Za staging pripremiti odvojenu Neon bazu, pokrenuti postojeće aditivne migracije, odobriti test profil, izvršiti jedan javni-only run, proveriti collector history/shortlist, pa ponoviti run i proveriti job ID-je/istoriju. Testirati grešku jednog board-a, izmenu kriterijuma i CV korekciju. Tek zatim uključiti raspored.

Nema nove schema migracije niti nove runtime zavisnosti. Rollback je vraćanje V2 commit-a; već sačuvani profili, poslovi i prijave ostaju. Feature može biti kontrolisan postojećim source izborom; `apify` je zasebni opt-in fallback. Za opšti plan i odluke o pet referentnih projekata videti [V2 plan](../product/job-finder-v2.md).
