# V2 — pokretanje i provera

## Isporučene promene

Direktni Greenhouse/Lever/Ashby adapteri koriste postojeći `atsBoardUrls`, `sourcesEnabled`, progress i collector history. Nema nove baze, layout-a niti kopiranog projekta. Direct ATS ide pre Remotive/Arbeitnow, zatim samo eksplicitno izabrani Apify/LinkedIn/regionalni izvori. Novi profili ne uključuju plaćene izvore; postojeći eksplicitni izbor ostaje sačuvan. Kada board promeni ATS ili nestane, greška ostaje u `collector_runs`; ostali board-ovi nastavljaju.

Dedup koristi source ID ili isti canonical URL. Dva različita requisition URL-a istog naslova ostaju odvojena. Persistence prepoznaje isti URL sa istim naslovom, ili potpuno isti originalni URL i promenjen naslov; zadržava postojeći job ID i istoriju prijave. To nije puni cross-source alias katalog. Concurrent upsert, prepoznavanje preusmerenih URL-ova i zatvaranje nestalih poslova ostaju sledeća migraciona faza.

AI cache sada uključuje opis i relevantna polja oglasa, profil, kriterijume/verziju, model i prompt. Pipeline ocenjuje oglase koji su preživeli ovaj prolaz i objavljuje samo uspešno ocenjene/cache rezultate iz tog prolaza. Opportunity je odvojen signal kvaliteta oglasa, sa navedenim komponentama i nepoznatim podacima. Čuva se u `scoreJson`, a MCP detalj ga računa za trenutni datum. Nije prognoza odgovora poslodavca; postojeći UI i match score ostaju.

CV i letter provera odbija nepodržane numeričke tvrdnje; grounding neuspeh blokira odobravanje. Pri odobravanju se ponovo proverava uređeni sadržaj prema aktuelnom odobrenom profilu. Ovo je deterministička provera poznatih obrazaca, ne dokaz svake semantičke tvrdnje. Postojeći outcome eventi i application board su sačuvani.

## Direktni LinkedIn, HelloWorld i Infostud (bez Apify-ja)

Dodato 2026-09-29. Sva tri izvora se čitaju direktno sa javnih stranica; Apify više nije potreban za njih.

| Izvor | Kako | Pauze / limit | Pravila |
|---|---|---|---|
| HelloWorld | lista `/oglasi-za-posao?q=` (offset paginacija `/stranica/30`) + stranica oglasa (`__job-text-body`, JSON-LD `datePosted`) | 0,8–1,6 s; najviše 12 strana liste po upitu | robots.txt dozvoljava; iskren User-Agent `OptraJobCollector` |
| Infostud | `__NEXT_DATA__` JSON sa liste i oglasa (`workFromHome`/`hybridWork`, plata, `textAd`) | 0,8–1,6 s; najviše 12 strana liste | robots.txt dozvoljava `/oglasi-za-posao` i `/posao`; `/rss_feed` se ne koristi |
| LinkedIn | javni guest endpointi `jobs-guest/.../seeMoreJobPostings/search` i `jobs-guest/jobs/api/jobPosting/{id}`, bez logina | 2–4 s između strana, 1–2,5 s između oglasa; najviše 4 strane | robots.txt i LinkedIn uslovi zabranjuju scraping; mali obim, prekid na prvi 429/redirect |

Zajedničko: hard filteri (`filterRawJobs`) se primenjuju na karticu **pre** zahteva za detalje, pa se ne troše zahtevi na nerelevantne naslove. Redirect se nikad ne prati (auth wall ili tuđi URL), a 429/999/3xx zaustavljaju izvor za taj prolaz. External ID-jevi su isti numerički ID-jevi koje je Apify čuvao, pa postojeći poslovi i prijave ostaju vezani. HelloWorld i Infostud traže i šire pojmove (`regionalSearchTerms`: osnovni naslov bez senioriteta, a za dizajn i „UX”, „dizajner”), jer srpski oglasi retko koriste tačan engleski naslov.

Radni režim: Infostud daje eksplicitne boolean vrednosti, pa je „onsite” činjenica. HelloWorld ga upisuje u lokaciju („Beograd | Hibrid”, „Rad od kuće”); grad bez oznake tretira se kao onsite. Kod `remote_ok_required` kriterijuma većina srpskih oglasa (hibrid/onsite) biće odbačena. To je očekivano ponašanje filtera, ne greška izvora.

LinkedIn fallback: ako je guest pristup blokiran i vraćeno je manje od `maxResults`, a `APIFY_TOKEN` postoji i dnevni budžet dozvoljava, isti upit ide preko Apify actor-a. Napomena o blokadi i fallback-u upisuje se u `collector_runs.error` uz status `ok`. Na Vercelu (datacenter IP) blokada je verovatnija nego lokalno, pa je fallback tamo korisniji.

Live smoke 2026-09-29: LinkedIn „Senior Product Designer”/Remote je vratio 30 kartica i 12 oglasa sa punim opisom za oko 30 s, bez blokade. Infostud i HelloWorld za „dizajner” vraćaju 30 kartica po strani. Relevantan dizajnerski oglas u Srbiji je u tom trenutku bio samo jedan („UX/UI dizajner”, hibrid), isti na oba boarda. Testovi: `tests/direct-boards.test.ts` (fixture, bez mreže).

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
