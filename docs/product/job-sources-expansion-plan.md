# Širenje liste poslova — plan

**Status:** predlog · **Datum:** 2026-09-30

Nastavlja fazu 3 iz [universal-jobs-plan.md](./universal-jobs-plan.md) i izbor izvora u `src/modules/occupations/sources.ts`. Ne uvodi novi frontend, novu bazu niti plaćeni crawl. Svaki novi izvor ide istim ugovorom kao postojeći: javne stranice ili dokumentovan board API, pauza između zahteva, prekid na 429, greška jednog izvora ne gasi ostale, fixture test bez mreže.

## Polazna tačka

`planSources` već bira boardove po porodici i lokaciji:

| Situacija | Izvori koji se uključe |
|---|---|
| Srbija, bilo koja porodica | Infostud, LinkedIn |
| Srbija, tech | + HelloWorld |
| Remote, tech ili kancelarija | Remotive, Arbeitnow, Greenhouse / Lever / Ashby (10 SaaS firmi) |
| EU na lokaciji | Arbeitnow, LinkedIn |

Podrazumevano više nije „samo remote dizajn”: remote se traži samo ako ga osoba izabere, a starosni filter ne baca oglas mlađi od 30 dana. Dnevni plafon je i dalje 80 oglasa, 12 po upitu.

Lista je i dalje uska iz tri razloga:

1. **Dizajn filteri su ostali u kolektorima.** `collectors/remotive.ts` uvek traži `category=design`. `discovery/remotive.ts` prima kategoriju, ali podrazumeva `design`. Oba Arbeitnow adaptera zadržavaju samo naslove koji liče na dizajn.
2. **Srpska pretraga ima jedan upit.** Infostud i HelloWorld dobijaju najviše 4 pojma (`regionalSearchTerms`) i jednu lokaciju. Beograd, Novi Sad i Niš se ne pretražuju odvojeno.
3. **Nema drugog opšteg srpskog boarda.** Van IT-ja jedini izvor je Infostud. NSZ i EURES su odobreni kao smer u planu od 29. septembra, ali adapteri ne postoje.

## Cilj

Za isti odobreni profil, posle filtera, više jedinstvenih oglasa koji odgovaraju zanimanju. Redosled tržišta ostaje: Srbija, pa remote, pa EU na lokaciji. Obim ostaje kvalifikovani posao uz CV. Nekvalifikovani oglasi i oglasnik-stil (dnevnice, poslovi bez struke) nisu cilj ove faze.

Uspeh se meri na pet persona iz universal plana (programer, medicinska sestra, vozač, kasirka se preskače jer je van obima v1, marketing menadžer), plus jedna zanatska persona umesto kasirke: električar u Nišu. Za svaku: broj oglasa posle filtera, koliko je jedinstveno u odnosu na Infostud, i razlog odbacivanja.

## Šta se ne radi

- **LinkedIn se ne širi.** Guest pristup je već na ivici njihovih uslova, a na datacenter IP-u se često blokira. Više srpskih oglasa dolazi sa drugog boarda nego sa još jednog LinkedIn upita.
- **JobSpy se ne uvodi.** Ostaje isključen, kao u Job Finder V2. Ne zaobilaze se login, blokada ni rate limit.
- **Putanje koje `robots.txt` zabranjuje se ne koriste.** Infostud `/rss_feed` i `/search` ostaju netaknuti.
- **Halo oglasi nisu u prvoj verziji.** Volumen je veliki, ali je većina van obima kvalifikovanog posla. Vraća se samo ako persona posle faza 1–3 i dalje ima tanku listu.
- **Nema automatskog pogađanja ATS platforme.** Novi vendor se dodaje tek kad je URL poznatog hosta, kao Greenhouse / Lever / Ashby.

## Faza 0 — popraviti filtere pre novih izvora

Najveći dobitak bez novog sajta. Dok Remotive i Arbeitnow odbacuju sve što nije dizajn, uključivanje tih izvora za sestru ili računovođu ne donosi ništa.

- Remotive kategorija dolazi iz `FAMILY_PROFILES.remotiveCategories`. Porodice bez kategorije (zdravstvo, zanati, transport, obrazovanje) ne zovu Remotive.
- Arbeitnow filtrira po sinonimima zanimanja, ne po regexu `design|ux|ui`. Isto u `collectors/arbeitnow.ts` i `discovery/arbeitnow.ts`.
- `regionalSearchTerms` diže granicu sa 4 na 8 kada profil ima srpske sinonime. I dalje seče na fiksni maksimum da jedan profil ne napravi desetine upita.
- Kad je lokacija samo „Serbia”, Infostud dobija tri upita: Beograd, Novi Sad, Niš. Ako je naveden grad, traži se taj grad. HelloWorld ostaje jedan upit, jer je board mali i IT.
- Pre i posle ove faze: fixture testovi i jedan ručni prolaz po personi. Ako sestra i električar i dalje imaju ispod 5 oglasa posle filtera, to je signal za fazu 1, ne za dizanje dnevnog plafona.

## Faza 1 — Poslovi.rs

Drugi opšti board u Srbiji. Pokriva kancelariju, zdravstvo, obrazovanje i deo zanata koji HelloWorld nema.

Uslov pre koda: pročitati uslove korišćenja i `robots.txt`. Ako listing ili stranica oglasa nisu dozvoljeni, faza staje i NSZ postaje sledeći opšti izvor.

Adapter prati Infostud: lista, pa detalj samo za naslove koji prođu `filterRawJobs`, pauza 0,8–1,6 s, najviše 5 strana, `SourceBlockedError` na 429. Novi `JobSource`: `poslovi`. `planSources` ga dodaje uz Infostud za svaku porodicu kad je lokacija Srbija.

Ostaje samo ako na test personama donese oglase kojih nema na Infostudu (drugi `externalId` i drugi canonical URL). Ako je preklop skoro potpun, izvor se ne uključuje podrazumevano.

## Faza 2 — Joberty, samo tech

Regionalni IT board. U `planSources` ide samo za `tech_digital` i lokaciju Srbija, pored HelloWorlda.

Isti gate: uslovi i `robots.txt`, pa isti polite adapter. Očekivan preklop sa HelloWorldom. Vredi ako donese firme kojih tamo nema (outsourcing studiji, regionalni oglasi). Ako ne, ostaje isključen.

## Faza 3 — NSZ

Već odlučeno 29. septembra: Nacionalna služba za zapošljavanje može da se doda posle provere uslova i `robots.txt`.

Ovo je izvor za zanimanja koja komercijalni boardovi slabo drže: zdravstvo, obrazovanje, zanati, transport, javni sektor, cela Srbija a ne samo Beograd. `planSources` ga uključuje za svaku porodicu kad je lokacija Srbija. Tech ga i dalje ima; ne zamenjuje HelloWorld.

Ako NSZ nema stabilan javni feed, adapter čita samo dozvoljene stranice pretrage i oglasa. Nema prijave u ime korisnika i nema naloga.

## Faza 4 — širi ATS, ne širi scrape

Deset podrazumevanih SaaS boardova pokriva remote tech. Sledeći korak su javni board API-ji koje firme već izlažu, jedan vendor po koraku:

1. Teamtailor
2. Workable
3. Recruitee
4. SmartRecruiters
5. Personio

Svaki korak: poznati HTTPS host, odbijanje proizvoljnog URL-a, fixture za payload, greška jednog boarda u `collector_runs`. Workday ostaje kasnije i samo uz eksplicitan URL, kao u V2 planu.

Poseban katalog, ne crawler: career URL-ovi velikih poslodavaca u Srbiji koji već koriste jedan od tih vendor-a (banke, telekom, veći IT). Katalog je ručna lista URL-ova u kodu, uključena samo za porodice sa `usesAtsBoards`. Ne skenira se otvoreni veb da bi se pogodio ATS.

## Faza 5 — EURES

Za EU na lokaciji, posle NSZ. Zvaničan portal, isti gate za uslove. U `planSources` zamenjuje „kasnije EURES” iz tabele faze 3 universal plana: EU na lokaciji dobija Arbeitnow, LinkedIn i EURES. Ne uključuje se za čistu Srbiju.

## Faza 6 — samo ako je lista i dalje tanka

Posle faza 0–3 meriti iste persone. Ako kvalifikovana persona i dalje ima ispod 5 oglasa:

- **FreeHire**, iza eksplicitnog uključivanja, posle live provere payload-a, paginacije, atribucije i limita. Već zabeleženo u Job Finder V2. Ne preuzimati njihovu infrastrukturu.
- **Halo oglasi (Posao)**, samo za porodicu čiji rezultati fale, i samo naslovi koji prođu sinonime zanimanja. Nije podrazumevani izvor.

Dnevni plafon od 80 se ne diže dok merenje ne pokaže da relevantni oglasi staju na cap, a ne na filter.

## Redosled

| Korak | Obim | Zavisi od | Šta dokazuje da vredi |
|---|---|---|---|
| 0. Filteri i gradovi | malo | — | Sestra i marketing dobijaju oglase sa Remotive/Arbeitnow; Infostud vraća Novi Sad i Niš |
| 1. Poslovi.rs | srednje | provera uslova | Jedinstveni oglasi van Infostuda |
| 2. Joberty | malo | provera uslova | IT firme van HelloWorlda |
| 3. NSZ | srednje | provera uslova | Zdravstvo, zanati, transport van Beograda |
| 4. Novi ATS vendor-i | srednje, jedan po jedan | — | EU/remote oglasi van 10 SaaS boardova |
| 5. EURES | srednje | faza 3 gate obrazac | EU na lokaciji |
| 6. FreeHire / Halo | malo | tanka lista posle 0–3 | Persona i dalje ispod 5 oglasa |

Faze 1, 2 i 4 mogu paralelno posle faze 0. Faza 3 čeka samo pravnu proveru, ne fazu 1.

## Provera

- Fixture testovi bez mreže, po ugledu na `tests/direct-boards.test.ts`: mapiranje hosta, prazan payload, 429, jedan board pada a ostali nastavljaju, dizajn regex više ne seče sestru.
- `planSources` test: Srbija + zdravstvo → Infostud, LinkedIn, Poslovi, NSZ, bez Remotive i bez ATS. Srbija + tech → plus HelloWorld i Joberty. Remote + tech → Remotive kategorije te porodice, ne `design` fiksno.
- Jedan ručni prolaz u browseru po personi posle faze 0 i posle prvog novog srpskog izvora.
- Live smoke je read-only GET, odvojen od testova, bez AI troška.

## Odluke u ovom predlogu

1. Prvo popraviti postojeće filtere, pa dodavati sajtove.
2. Sledeći srpski izvori, redom: Poslovi.rs, Joberty (samo tech), NSZ.
3. LinkedIn, JobSpy i zabranjene `robots.txt` putanje se ne šire.
4. Halo oglasi i FreeHire ostaju rezerva, ne podrazumevani izvor.
5. Novi ATS samo kao poznati javni board, jedan vendor po koraku.
