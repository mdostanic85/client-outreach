# Optra za sve vrste poslova — plan

**Status:** implementirano na grani `feat/universal-jobs` (faze 0–7) · **Datum:** 2026-09-29

### Šta je urađeno i gde se razlikuje od plana (2026-09-30)

- Faza 0 je već bila na `main`-u (Better Auth, `owned()`, podešavanja po nalogu).
- Katalog ima 127 kvalifikovanih zanimanja, ne ~300. Nepoznata zanimanja klasifikuje model, korisnik potvrđuje porodicu. ESCO/ISCO mapiranje nije urađeno.
- `relevantProjects` nije preimenovan u `evidence`; umesto toga `evidenceKind` dobija `certificate`, `work_sample`, `reference`.
- NSZ i EURES nisu dodati kao izvori (odluka 5: tek posle provere uslova korišćenja).
- Persona 4 je kuvar u Novom Sadu umesto kasirke bez CV-ja (odluka 1). Kasir, konobar i prodavac su izbačeni iz kataloga.
- Ručni prolaz kroz browser uz prijavu nije urađen za persone; onboarding ekrani su provereni vizuelno.


## Polazna tačka

Optra treba da radi za svakog ko traži posao: programera, medicinsku sestru, vozača kamiona, prodavca, računovođu, konobara, dizajnera. Danas je aplikacija napravljena za jednu osobu (senior product designer, remote, EU/US). Ta pretpostavka je upisana u podrazumevane vrednosti, filtere, izvore, bodovanje, promptove i tekst u interfejsu.

Cilj: svaki novi nalog kreće od praznog profila. Survey otkriva vrstu posla, a sve kasnije (izvori, filteri, bodovanje, CV) se prilagođava toj vrsti posla.

## Šta je danas vezano za dizajn

| Oblast | Gde | Šta je fiksno |
|---|---|---|
| Podrazumevana pretraga | `src/modules/search-profile/schemas.ts` | naslovi „Senior Product Designer”, ključne reči „Figma”, lista SaaS ATS board-ova, `remoteRequired: true` |
| Generisanje pretrage | `src/modules/search-profile/generate.ts`, `prompts/jobs/search-profile.md` | isključuje „Junior/Graphic Designer”, koristi `designTools`, primeri samo za dizajn |
| Filteri naslova | `src/modules/jobs/filters.ts` | poseban regex za dizajnerske naslove |
| Izvori | `collectors/remotive.ts` (`category=design`), `collectors/arbeitnow.ts` (samo „designish”), `collectors/run.ts` (dodaje „UX”, „dizajner”) |
| Profil | `src/modules/profile/schemas.ts`, `prompts/profile/extract.md` | polje `designTools`, projekti tipa „portfolio case study” |
| Bodovanje | `src/modules/matching/score.ts`, `prompts/jobs/match-and-explain.md` | dimenzija `portfolioFit`, primeri iz SaaS dizajna |
| Tekst u UI | `market-fit.ts`, `welcome/page.tsx`, `auth/product-panel.tsx`, `search-experience.tsx`, `learning/proposals.ts` | „senior product designer” u tekstovima i promptovima |
| Klijenti / outreach | ceo „Clients” režim | ima smisla samo za freelancere |

## Faza 0 — jedna baza, jedan kod (preduslov)

Baza je već migrirana kodom iz worktree-a `google-login` (Better Auth tabele `auth_*`, `user_id NOT NULL` na svim tabelama naloga, `settings.survey_json`). Glavni `main` kod ne upisuje `user_id`, pa će upload CV-ja i čuvanje profila pasti na novom nalogu.

1. Spojiti `google-login` worktree (više naloga, Google login, survey onboarding) sa trenutnim necommitovanim radom na `main` (direktni izvori, bodovanje po dimenzijama).
2. Svaki upit na tabelama naloga ide kroz `owned(table)` / `currentUserId()`.
3. Podešavanja se prave pri prvom korišćenju naloga (`getUserSettings`), nikad globalno u `ensureDb`.
4. Obrisati prečicu koja onboarding označava završenim ako negde postoji odobren profil.

Bez ove faze ostale faze nemaju stabilnu osnovu.

## Faza 1 — model zanimanja

Uvesti **porodicu posla** kao osnovni signal. Iz nje se izvodi sve ostalo.

| Porodica | Primeri | Tipični zahtevi | Dokaz rada |
|---|---|---|---|
| Tech i digitalno | programer, analitičar, dizajner | veštine, alati, portfolio/GitHub | projekti, repo, portfolio |
| Kancelarija i biznis | računovođa, HR, prodaja, marketing | iskustvo, jezici, softver | CV, rezultati |
| Zdravstvo i nega | sestra, farmaceut, negovatelj | licenca, smene | licenca, sertifikati |
| Zanati i tehnika | električar, mehaničar, varilac | sertifikat, alat, teren | sertifikati, godine rada |
| Transport i logistika | vozač, magacioner, dostavljač | kategorija dozvole, tahograf, ADR | dozvola, godine |
| Ugostiteljstvo i trgovina | konobar, kuvar, kasir | smene, vikend, sanitarna knjižica | iskustvo |
| Obrazovanje | nastavnik, vaspitač | diploma, licenca | diploma |
| Proizvodnja i fizički rad | operater mašine, radnik u proizvodnji | smene, fizička spremnost | iskustvo |

Implementacija:

- `src/modules/occupations/` sa listom zanimanja (naziv SR + EN, sinonimi, porodica). Početi sa ~300 najčešćih, kasnije mapirati na ESCO/ISCO kodove.
- Autocomplete u surveyu pretražuje sinonime na srpskom i engleskom („vozač C kategorije”, „truck driver”, „medicinska sestra”, „nurse”).
- Nepoznato zanimanje prolazi kroz LLM, koji ga svrsta u porodicu. Korisnik to potvrđuje.

Promene u profilu (`StructuredProfile`):

- `designTools` + `technicalTools` → jedno polje `tools`.
- Nova polja: `occupationFamily`, `licenses` (npr. vozačka C/CE, medicinska licenca), `certifications` (već postoji), `languages` sa nivoom, `schedule` (smene, noćni rad, vikend), `commuteRadiusKm`, `willingToTravel`, `workAuthorization`, `educationLevel`.
- `relevantProjects` → opšte `evidence` (projekat, sertifikat, primer rada, preporuka). `portfolio_project` postaje jedna od vrsta.

## Faza 2 — onboarding

Survey iz `google-login` je dobra osnova. Treba ga osloboditi pretpostavki i dodati grane po porodici.

**Tok:**

1. **Uvod** — šta aplikacija radi, oko 3 minuta.
2. **Koji posao tražiš** — slobodan unos + autocomplete zanimanja. Posle toga se zna porodica.
3. **Iskustvo** — „Bez iskustva / Do 2 godine / 2–5 / 5+ / Vodim tim”. Za tech i biznis dodatno junior/mid/senior/lead.
4. **Vrsta angažmana** — puno radno vreme, skraćeno, sezonski, smenski, honorarno/freelance, praksa.
5. **Gde** — grad i koliko daleko sme da putuje (km), ili hibrid, ili remote. Podrazumevano je rad na lokaciji; remote se ne pretpostavlja.
6. **Plata** — prema državi: u Srbiji mesečno neto u RSD, na drugim tržištima godišnje bruto ili po satu. Može „Ne želim da navedem”.
7. **Kada možeš da počneš.**
8. **Pitanja po porodici** (prikazuju se samo relevantna):
   - Transport: kategorije dozvole, ADR, tahograf kartica, međunarodne ture.
   - Zdravstvo: licenca, odeljenje, smene/dežurstva.
   - Ugostiteljstvo i trgovina: vikendi, noćne smene, sanitarna knjižica.
   - Zanati: sertifikati, sopstveni alat.
   - Tech i digitalno: portfolio/GitHub, stack.
   - Svi: jezici i nivo.
9. **Šta ti je najvažnije** — do 3 prioriteta.
10. **Materijali**:
    - CV je **opcioni**. Bez CV-ja nudimo „Napravi profil bez CV-ja”: kratka pitanja o poslednja 1–3 posla (gde, koliko dugo, šta si radio). Iz toga pravimo profil i jednostavan CV.
    - Sajt, LinkedIn i GitHub prikazujemo samo kada porodica to koristi.
11. **Analiza → „Evo šta smo razumeli” → potvrda → prva pretraga.**

**Pravila:**

- Svaki odgovor se čuva odmah (`survey_json`), tako da korisnik može da nastavi gde je stao.
- Odgovori iz surveya imaju prednost nad onim što je model pročitao iz CV-ja (već postoji u `applySurveyToProfile`).
- Tekst u surveyu je jednostavan, bez žargona kao što je „seniority” ili „ATS”.

## Faza 3 — pretraga i izvori

- `EMPTY_SEARCH_PARAMS` bez sadržaja: bez naslova, ključnih reči i ATS board-ova. `remoteRequired: false`, `remotePolicy: "any"`. Sve se popunjava iz surveya.
- Generator pretrage dobija porodicu i zanimanje. Pravi sinonime na jeziku tržišta („vozač kamiona”, „vozač C kategorije”, „profesionalni vozač”). Tako se `regionalSearchTerms` zamenjuje opštim rešenjem.
- Izvor se bira prema porodici i lokaciji:

| Situacija | Izvori |
|---|---|
| Srbija, bilo koja porodica | Infostud, NSZ (Nacionalna služba za zapošljavanje), LinkedIn |
| Srbija, tech | + HelloWorld |
| Remote, tech/digitalno/biznis | Remotive (sve kategorije), Arbeitnow, ATS board-ovi |
| EU na lokaciji | Arbeitnow, LinkedIn, kasnije EURES |

- Uklanja se fiksno za dizajn: Remotive `category=design` (kategorija se mapira iz porodice), Arbeitnow „designish” filter, dizajnerski regex u `jobs/filters.ts`. Filter naslova koristi sinonime zanimanja.
- ATS board-ovi postaju opcija za tech/biznis. Lista se predlaže po industriji, ne po dizajnu.
- Remote gate se primenjuje samo kada je korisnik izabrao remote.

## Faza 4 — bodovanje

Dimenzije u `score.ts` postaju opšte:

| Ključ | Meri |
|---|---|
| `skills` | veštine i alati iz oglasa |
| `experience` | godine i relevantno iskustvo |
| `seniority` | nivo (manja težina za porodice gde nivo ne postoji) |
| `requirements` | dozvole, licence, sertifikati, obrazovanje, jezici — **tvrdi uslov** kada oglas kaže „obavezno” |
| `location` | udaljenost / remote / hibrid |
| `schedule` | smene, vikendi, vrsta angažmana |
| `compensation` | plata (izostavlja se kad je nepoznata, kao sada) |
| `evidenceFit` | portfolio, projekti, primeri rada — samo gde je relevantno |
| `industry`, `language` | kao sada |

- Težine po porodici. Na primer, transport ima veće težine za `requirements` i `location`, tech za `skills` i `evidenceFit`. Korisnik ih i dalje može menjati kroz learning predloge (`settings_job_scoring`).
- Nedostatak obavezne dozvole ili licence čini oglas neprihvatljivim, bez obzira na ostale ocene.
- `match-and-explain.md` dobija primere iz 4–5 porodica i instrukciju da oceni samo relevantne dimenzije; ostale vraća kao `null`.

## Faza 5 — prijava

- Šablon CV-ja po porodici: hronološki jednostavan (zanati, transport, trgovina), sa projektima (tech, kreativa), sa licencama (zdravstvo, obrazovanje). Opcija Europass za EU.
- Propratno pismo je opciono. Mnogi lokalni oglasi traže prijavu preko forme, telefona ili mejla. Prikazati „Kako se prijaviti” iz oglasa: telefon, mejl, link.
- Jezik izlaza prati jezik oglasa (srpski oglas → srpski CV i pismo).

## Faza 6 — interfejs i tekst

- Ukloniti dizajnerski tekst iz welcome stranice, product panela, market-fit saveta, search experience poruka i learning promptova.
- Režim „Clients” (outreach) je skriven. Prikazuje se samo ako korisnik u surveyu izabere freelance/honorarno.
- Jezik interfejsa: srpski i engleski (odluka ispod).

## Faza 7 — provera

Pet test persona, svaka prolazi survey → parametre pretrage → filtere → bodovanje → CV:

1. Programer, remote EU, ima GitHub.
2. Medicinska sestra, Beograd, smene, licenca.
3. Vozač kamiona, CE + ADR, međunarodne ture.
4. Kasirka, Novi Sad, bez CV-ja, skraćeno radno vreme.
5. Marketing menadžer, hibrid, Beograd.

Za svaku personu fixture testovi bez mreže (kao `tests/direct-boards.test.ts`) i jedan ručni prolaz u browseru.

## Redosled

| Korak | Obim | Zavisi od |
|---|---|---|
| 0. Spajanje google-login + main | veliko | — |
| 1. Model zanimanja + polja profila | srednje | 0 |
| 2. Onboarding sa granama | veliko | 1 |
| 3. Pretraga i izvori | srednje | 1 |
| 4. Bodovanje | srednje | 1 |
| 5. Prijava | srednje | 4 |
| 6. UI tekst | malo | 2 |
| 7. Test persone | uz svaki korak | — |

Faze 2, 3 i 4 mogu paralelno posle faze 1.

## Odluke (2026-09-29)

1. **Obim**: samo kvalifikovani poslovi, uz CV. Nekvalifikovani poslovi bez CV-ja nisu cilj. CV je **obavezan** u onboardingu; „profil bez CV-ja” se ne pravi. Porodica „Proizvodnja i fizički rad” i nekvalifikovani deo „Ugostiteljstva i trgovine” ispadaju iz prve verzije.
2. **Tržišta**: Srbija prvo, zatim remote, zatim EU na lokaciji.
3. **Jezik interfejsa**: samo engleski. Sinonimi zanimanja i dalje imaju srpske varijante zbog pretrage srpskih boardova, a CV i pismo prate jezik oglasa.
4. **Clients / outreach**: ostaje, ali samo za korisnike koji u surveyu izaberu freelance.
5. **NSZ i EURES**: mogu se dodati, uz proveru uslova korišćenja i robots.txt kao za postojeće izvore.
