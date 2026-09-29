# Job Finder V2 — plan i kontrolisano uvođenje

Datum pregleda: 2026-09-29. Ciljni repozitorijum: `mdostanic85/client-outreach`.

## Zatečeno stanje

Next.js 16.2.12 / React 19, TypeScript, Drizzle i Neon PostgreSQL. README još opisuje SQLite i zato nije pouzdan vodič za bazu. Postoje `collectors/run`, `jobs/filters`, `jobs/persist`, `matching/evaluate`, verzionisani profil, application packages, grounding, ishodi prijava i worker. Čuvamo postojeće stranice, odobravanje profila, shortlist, CV editor i slanje uz postojeće odobrenje.

Problemi iz koda: Greenhouse/Lever/Ashby zavise od Apify tokena; normalizacija profila ponovo uključuje LinkedIn/HelloWorld i kad ih korisnik isključi; isti naslov/kompanija/lokacija spajaju različite oglase; filtriranje propušta eksplicitni onsite; AI cache ne proverava izmenjeni opis ili verziju kriterijuma. Grounding metrika proverava samo propratno pismo. Ovo su konkretne polazne tačke, ne razlog za novi frontend.

## Javne reference i odluke

Pregledani README/API opisi i LICENSE datoteke; bez kopiranja projekata ili dodavanja njihovih zavisnosti. Sve navedene licence su MIT; ako se kasnije prenosi kod, sačuvati originalni copyright i MIT tekst u THIRD_PARTY_NOTICES i zabeležiti commit/verziju. Licenca koda ne garantuje uslove hosted API-ja niti dostupnost oglasa.

| Referenca | Provereno | Odluka |
|---|---|---|
| [FreeHire](https://github.com/strelov1/freehire), [licenca](https://github.com/strelov1/freehire/blob/main/LICENSE), [API](https://freehire.me/docs/api) | Dokumentovan javni keyless jobs API; odvojeni radnici i evidencija izvora | Sekundarni discovery adapter iza eksplicitnog uključivanja. Pre uključivanja proveriti live payload, paginaciju, atribuciju i limite. Broj oglasa iz README nije nezavisno potvrđen. Ne preuzimati Go/Svelte infrastrukturu. |
| [ats-jobs](https://github.com/shunsukefuruyama/ats-jobs), [licenca](https://github.com/shunsukefuruyama/ats-jobs/blob/main/LICENSE) | Node biblioteka sa normalizovanim public-board izlazom | Referenca za adaptere. Za prvu fazu sopstveni mali adapteri za tri već podržana izvora; izbegnuti automatsko probanje 12 platformi i zavisnost od vrlo mladog projekta. Workday kasnije, po eksplicitnom URL-u. |
| [JobSpy](https://github.com/speedyapply/JobSpy), [licenca](https://github.com/speedyapply/JobSpy/blob/main/LICENSE) | Python scraper biblioteka za agregatore | Opcioni izolovani fallback, isključen podrazumevano. Ne uvoditi Python servis u postojeći Next projekat bez dokaza da donosi relevantne dodatne poslove. Ne zaobilaziti login, blokade ili rate limits. |
| [CareerPulse](https://github.com/tcpsyn/CareerPulse), [licenca](https://github.com/tcpsyn/CareerPulse/blob/main/LICENSE) | Self-hosted discovery, matching, tailoring, scheduler | Referenca za objašnjive rezultate, verzije CV-ja i odvajanje zakazivanja od zahteva. Koristiti postojeće module i AI providere. Ne kopirati američke salary pretpostavke ili auto-send funkcije. |
| [JobSync](https://github.com/Gsync/jobsync), [licenca](https://github.com/Gsync/jobsync/blob/main/LICENSE) | ATS company watchlists, application tracking i MCP | Referenca za board katalog i MCP. Zadržati postojeće ishode prijava; prvi MCP pristup samo čitanje, lokalni stdio, bez mail alata. |

Ugovori primarnih izvora: [Greenhouse](https://docs.greenhouse.io/job-board.html), [Lever](https://github.com/lever/postings-api), [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api). GET board podaci su javni; ništa u V2 ne šalje ATS prijave.

## Redosled implementacije

1. **Direktni ATS i izbor izvora.** Parsirati samo poznate HTTPS board hostove; odbiti proizvoljne URL-ove/redirecte. Greenhouse sa opisom, Lever US/EU, Ashby listed jobs. Ograničen timeout/retry, validacija payloada, greška po board-u u `collector_runs`. ATS pre agregatora; relevantnost pre limita. Sačuvati eksplicitni izbor izvora; nove profile početi javnim izvorima. Postojeći Apify ostaje samo eksplicitni fallback. Testovi: mapping, region, malformed payload, 429, izolacija greške, izbor izvora, cap.
2. **Identitet i hard filteri.** Dedup po source+externalId ili canonical URL-u, nikad automatski po naslovu za različite requisition ID-je. Sačuvati originalnu vezu. Nepoznat datum/remote/salary označiti kao nepoznato; `updated_at` nije datum objave. Eksplicitni onsite/hybrid odbaciti kada je remote obavezan. Testovi: isti URL sa tracking parametrima, različiti oglasi istog naslova, eksplicitni onsite, nepoznato nije potvrđena podobnost.
3. **Matching i opportunity.** Ispraviti cache: profil + kriterijumi + sadržaj oglasa + prompt + model. Zadržati objašnjenja, rizike i nedostajuće uslove. Odvojeni deterministički opportunity signal meri svežinu i kvalitet informacija; nije verovatnoća zaposlenja niti zamena za AI match. Hard zabrane uvek imaju prednost. Ne plaćati AI za odbačene oglase.
4. **CV i praćenje.** Nadograditi postojeći grounding tako da izmišljene metrike proverava i u CV-ju; ne dodavati iskustva, datume, poslodavce ili veštine. Postojeći application packages i append-only `jobOutcomeEvents` ostaju izvor istine. Pregled i slanje ostaju odvojeni; tokom implementacije nema slanja mejlova niti prijava. Testirati fabrication i čuvanje postojećih ishoda.
5. **Worker i MCP.** Poseban job-only worker da zakazivanje ne pokreće client-outreach/mail. Operativni primer zakazivanja sa sprečavanjem preklapanja; bez instaliranja rasporeda tokom razvoja. MCP prvo lokalni read-only pristup bounded shortlist/detail podacima, bez CV-ja i tajni podrazumevano. Testirati protokol i pogrešne argumente. Za udaljeni MCP potrebni su zasebna autentikacija i pristupne kontrole.

## Kasnije, posle pilot-podataka

FreeHire produkcijsko uključivanje tek posle live contract testa i provere uslova; JobSpy samo ako ATS pokrivenost nije dovoljna. Potpun cross-source alias katalog i lifecycle zatvaranja traže aditivnu migraciju: `job_sources(job_id, source, external_id, canonical_url, first_seen, last_seen)` sa unique(source, external_id). Ne zatvarati poslove na osnovu neuspešnog ili skraćenog crawl-a. Ne menjati postojeće job ID-je vezane za prijave. Salary hard filter tek kada postoje pouzdani currency/period/amount podaci; ne porediti godišnje i satne iznose kao isti broj.

## Validacija i rollout

Pre promena pokrenuti postojeće testove. Svaku fazu proveriti fixture testovima bez mreže i plaćenih API poziva; zatim TypeScript, lint i production build. Live read-only ATS smoke zasebno. Ne pokretati migracije ili worker nad korisnikovom bazom bez test okruženja. Zaštita UI-ja: nema izmene layout-a; kompatibilnost existing `RawCollectedJob` ugovora. End-to-end provera sa odobrenim profilom, bazom i AI konfiguracijom ostaje deployment gate ako kredencijali nisu dostupni.

Rollback: vratiti commit/patch; nema destruktivne migracije u prvim fazama. Sačuvani izvori i istorija ostaju. Direktne izvore je moguće isključiti postojećim izborom izvora. Metrike pilota: uspeh po board-u, broj jedinstvenih relevantnih oglasa, broj hard-drop razloga, AI trošak, korisnički sačuvani/prijavljeni poslovi. Ne tvrditi da je V2 produkcijski potvrđen samo na osnovu unit testova.

## Status

Plan napravljen pre implementacije. Rezultati izvršenja i ograničenja biće zabeleženi u `docs/operations/job-finder-v2.md`.
