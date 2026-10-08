# Handleiding & runbook — Sieradenkoningin

Voor de eigenaar en het team (deel 1) en voor wie de technische kant beheert (deel 2).
Beheer: **https://‹jouw-domein›/admin** · Schermafbeeldingen staan in `docs/runbook/`.

---

## Deel 1 — Dagelijks gebruik van het beheer

### 1. Inloggen en tweestapsverificatie
1. Ga naar `/admin/login` en log in met je e-mailadres en wachtwoord.
2. **Eerste keer:** scan de QR-code met een authenticator-app (Google Authenticator, 1Password, Microsoft Authenticator). Vul de 6 cijfers in.
3. Je krijgt **10 herstelcodes**. Bewaar ze op papier of in je wachtwoordbeheerder. Elke code werkt één keer, als je je telefoon niet bij de hand hebt.
4. Daarna vraagt het beheer bij elke login de 6-cijferige code.
5. Na 12 uur zonder activiteit (of uiterlijk na 7 dagen) log je opnieuw in.

**Toestel kwijt en geen herstelcodes meer?** Een andere eigenaar kan bij *Gebruikers* op “2FA resetten” klikken. Ben je de enige eigenaar, zie §2.6 (technische reset).

### 2. Rollen en gebruikers (*Instellingen → Gebruikers*)
| Rol | Mag |
|---|---|
| Eigenaar | Alles, inclusief instellingen, gebruikers, auditlog, rapporten, terugbetalingen en klantgegevens verwijderen |
| Redacteur | Producten, categorieën, collecties, media, content, voorraad, kortingscodes; bestellingen alleen bekijken |
| Fulfilment | Bestellingen verwerken en verzenden, voorraad; catalogus bekijken |
| Klantendienst | Bestellingen verwerken, terugbetalen, klanten beheren |

- **Uitnodigen:** naam, e-mail en rol → de persoon krijgt een mail met een link (7 dagen geldig), kiest een wachtwoord en stelt 2FA in.
- **Deactiveren:** de persoon wordt meteen overal uitgelogd. De laatste actieve eigenaar kan niet gedeactiveerd of gedegradeerd worden.
- **Auditlog:** elke wijziging in het beheer staat in *Instellingen → Auditlog* (wie, wat, wanneer, welke velden).

### 3. Producten toevoegen (*Catalogus → Producten → Nieuw product*)
1. **Naam, omschrijving, “Met betekenis”, onderhoud en materiaal** in het Nederlands; de Franse tab is aanbevolen (een oranje markering toont ontbrekende vertalingen).
2. **Categorie, prijs** (incl. 21% btw, bv. `49,95`) en eventueel een **oude prijs** voor solden.
   - Bij een prijsverlaging toont de winkel automatisch de wettelijk verplichte “laagste prijs van de voorbije 30 dagen”.
3. **Foto's:** sleep ze in het vak. Minimaal 1600 px aan de kortste zijde. De eerste foto is de hoofdfoto. Vul voor elke foto een **alt-tekst** in (beschrijving voor blinden en Google) — verplicht in het Nederlands.
4. **Varianten:** kies metalen en maten → de tabel maakt per combinatie een artikelnummer (SKU) met voorraad en eventueel een afwijkende prijs.
5. **SEO:** de webadres-naam (slug) wordt automatisch gemaakt; titel en beschrijving zijn optioneel.
6. **Status:** *Concept* (onzichtbaar) of *Actief* (in de winkel). Actief kan pas met minstens 1 foto met alt-tekst en 1 variant.
7. Klik **Opslaan** (onderaan, blijft zichtbaar). Verlaat je de pagina met niet-opgeslagen wijzigingen, dan waarschuwt het beheer.

Handig: **Dupliceren** (voor een gelijkaardig stuk), **Archiveren** (uit de winkel, blijft in oude bestellingen), en bij *Gerelateerd* / *Maak de set compleet* koppel je producten die op de productpagina samen getoond worden.

**Veel producten tegelijk?** *Catalogus → Import / export*: download het CSV-sjabloon, vul het in Excel in, upload → je ziet eerst een **proefrun** (wat nieuw is, wat wijzigt, welke rijen fouten bevatten) → bevestig.

### 4. Voorraad (*Catalogus → Voorraad*)
- Filter op “lage voorraad” of “uitverkocht”.
- Pas de voorraad aan met + of −, **altijd met een reden** (bv. “telling”, “beschadigd”). Elke wijziging komt in de voorraadhistoriek.
- Voorraad kan nooit negatief worden.
- Tijdens het afrekenen wordt voorraad **15 minuten gereserveerd**; pas bij betaling wordt ze echt afgeboekt.
- Klanten die op “Mail me” klikten bij een uitverkochte variant, krijgen automatisch één e-mail zodra er weer voorraad is.

### 5. Bestellingen verwerken (*Verkoop → Bestellingen*)
Statussen: **In afwachting** (nog niet betaald) → **Betaald** → **In behandeling** → **Verzonden** → **Geleverd**. Daarnaast: Geannuleerd / Terugbetaald.

**Dagelijkse routine**
1. Open *Bestellingen* en filter op **Betaald** (het getal in het menu toont hoeveel er wachten).
2. Selecteer bestellingen → **Markeer in behandeling**.
3. Open een bestelling → **Pakbon afdrukken** (print-vriendelijk).
4. **Verzendlabel maken** (via Sendcloud/bpost; ook in bulk vanuit de lijst) → label afdrukken en op het pakje kleven.
5. Na afgifte bij bpost: **Markeer verzonden** (of het gebeurt automatisch via de track & trace van Sendcloud). De klant krijgt een mail met de track & trace-link.

**Interne notitie:** onderaan de bestelling, alleen zichtbaar voor het team. De tijdlijn toont alles wat er met de bestelling gebeurde.

**Factuur:** wordt automatisch gemaakt bij betaling (PDF, met jouw bedrijfsgegevens uit *Instellingen → Winkel*). Factuurnummers zijn opeenvolgend zonder gaten.

### 6. Terugbetalen (*bestelling → Terugbetalen*)
Alleen eigenaar en klantendienst.
1. Kies **volledig**, een **bedrag**, of **per lijn** (aantal stuks).
2. Vink **“terug in voorraad”** aan als de juwelen verkoopbaar terugkomen.
3. Bevestig → Mollie betaalt terug op de oorspronkelijke betaalmethode; de klant krijgt een bevestigingsmail.
Je kan nooit meer terugbetalen dan er betaald werd.

### 7. Een mislukte betaling
- Bij “mislukt”, “geannuleerd” of “verlopen” wordt de gereserveerde voorraad vrijgegeven en krijgt de klant automatisch een mail met een link om opnieuw te betalen.
- De bestelling staat op *Geannuleerd*. Er is niets te doen, tenzij de klant contact opneemt: verwijs naar de link in de mail, of laat de klant opnieuw bestellen.
- Twijfel over de status? Kijk in je **Mollie-dashboard** bij de betaling met hetzelfde bestelnummer. De winkel vraagt de status altijd zelf op bij Mollie.

### 8. Klanten (*Verkoop → Klanten*)
- Zoeken op naam, e-mail of telefoon; per klant: bestellingen, adressen, interne notities en tags (bv. `vip`).
- **Privacyverzoek (GDPR):** eigenaar → *Gegevens exporteren* (JSON-bestand) of *Account verwijderen* (onomkeerbaar; bestellingen blijven voor de boekhouding bewaard, zonder persoonsgegevens die niet op de factuur moeten). Klanten kunnen dit ook zelf in hun account.

### 9. Kortingscodes (*Verkoop → Kortingscodes*)
- Code (bv. `VALENTIJN15`), type (percentage, vast bedrag, gratis verzending), eventueel minimum bestelbedrag, geldigheid (Belgische tijd), maximaal aantal keer en per klant.
- Eén code per bestelling. Gebruik telt pas na betaling.
- Een gebruikte code kan je niet verwijderen (boekhouding), wel deactiveren.

### 10. De homepage en pagina's aanpassen (*Content → Pagina's*)
- Open **Home** (of een andere pagina). De pagina bestaat uit **blokken**: hero, categorieën, productrij, quote, editoriaal beeld + tekst, banner, tekst, FAQ, nieuwsbrief, maattabel …
- **Toevoegen:** “Blok toevoegen”. **Volgorde:** slepen of de pijltjes ↑ ↓. **Verbergen:** het oogje.
- **Plannen:** stel “zichtbaar vanaf / tot” in (bv. een Valentijn-hero van 1 tot 14 februari). De wissel gebeurt automatisch op dat moment.
- Elk tekstveld heeft een **NL**- en **FR**-tab. Links vul je per taal in (de webadressen verschillen per taal).
- **Voorbeeld** rechts: wissel tussen mobiel (390 px) en desktop (1440 px). Pas na **Publiceren / Opslaan** is het live.
- *Content → Menu's*: hoofdmenu en de kolommen onderaan de site. *Content → FAQ*: vragen en antwoorden per groep. *Content → Aankondiging*: de balk bovenaan de site (met optionele start- en einddatum).

### 11. Juridische teksten (*Instellingen → Juridisch*)
Plak hier de door je jurist nagelezen teksten (voorwaarden, privacy, cookies, herroeping, toegankelijkheid) in NL en FR en vink **“nagelezen door jurist”** aan. Tot dan tonen die pagina's een duidelijke plaatshouder. De **wettelijke vermeldingen** worden automatisch gevuld met de gegevens uit *Instellingen → Winkel* (naam, adres, KBO, btw).

### 12. Instellingen
- **Winkel:** bedrijfsgegevens (verschijnen op facturen), retourtermijn (min. 14 dagen), **onderhoudsmodus**.
- **Verzending:** gratis verzending vanaf (standaard € 50), uiterste besteltijd voor “morgen in huis”, tarieven per zone. De zone Nederland & Luxemburg staat klaar maar is uitgeschakeld.
- **Betalingen:** welke betaalmethoden de kassa toont (Bancontact staat altijd eerst). Activeer dezelfde methoden in je Mollie-dashboard.
- **E-mails:** antwoordadres, kopie van bestellingen, en een overzicht van verzonden e-mails.
- **Redirects:** oude adressen doorsturen naar nieuwe (301), bv. na het hernoemen van een product.

### 13. Onderhoudsmodus
*Instellingen → Winkel → Winkel tijdelijk sluiten*. Bezoekers zien een nette onderhoudspagina; ingelogde beheerders zien de winkel gewoon. Met de **preview-link** (zelfde pagina) kunnen genodigden de winkel toch bekijken (soft launch). Zet het vinkje uit om de winkel te heropenen.

### 14. Rapporten en dashboard
- **Dashboard:** netto-omzet, bestellingen, gemiddelde orderwaarde en terugbetalingen (vandaag / 7 / 30 dagen, met vergelijking), te verwerken bestellingen, lage voorraad, topproducten.
- **Rapporten:** kies een periode → omzet per dag, per categorie, per product, **btw-overzicht per maand** (voor je boekhouder) en kortingscodes. Elk overzicht kan je als **CSV** (Excel) downloaden.

---

## Deel 2 — Technisch beheer

### 2.1 Architectuur in het kort
SvelteKit 3 op **Cloudflare Workers**, database **Neon Postgres** (EU), afbeeldingen in S3-compatibele opslag (Neon / Cloudflare R2), betalingen **Mollie**, verzending **Sendcloud**, e-mail **Postmark**, nieuwsbrief **Brevo**. Elke externe dienst valt automatisch terug op een **simulatie** als de sleutel ontbreekt (handig voor test en preview, nooit voor productie).

### 2.2 Geheimen (Cloudflare → Workers → Settings → Variables, of `wrangler secret put NAAM`)
`DATABASE_URL`, `SESSION_SECRET`, `TOTP_ENC_KEY` (32 bytes base64), `STORAGE_ENDPOINT/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY/REGION`, `PUBLIC_MEDIA_URL`, `MOLLIE_API_KEY`, `SENDCLOUD_PUBLIC_KEY/SECRET_KEY`, `POSTMARK_TOKEN`, `EMAIL_FROM`, `SHOP_INBOX`, `BREVO_API_KEY/LIST_ID`, `TURNSTILE_SECRET` + `PUBLIC_TURNSTILE_SITE_KEY`, `CRON_SECRET`, `SENTRY_DSN`, `PUBLIC_SITE_URL`, `PUBLIC_PLAUSIBLE_DOMAIN`, `PUBLIC_GA4_ID`. Zie `.env.example`.

### 2.3 Geheimen roteren
| Geheim | Hoe | Gevolg |
|---|---|---|
| `SESSION_SECRET` | nieuwe willekeurige waarde, deploy | lopende preview-/uploadlinks ongeldig; sessies blijven geldig (die zijn gehasht in de DB) |
| `TOTP_ENC_KEY` | **Niet zomaar wijzigen**: bestaande 2FA-geheimen worden onleesbaar. Eerst alle beheerders laten herinschrijven (2FA resetten), dan roteren | iedereen stelt 2FA opnieuw in |
| `MOLLIE_API_KEY`, `POSTMARK_TOKEN`, `SENDCLOUD_*`, `BREVO_API_KEY` | nieuwe sleutel in het dashboard van de dienst → secret bijwerken → oude intrekken | geen |
| `CRON_SECRET` | nieuwe waarde → deploy | geen |
| `DATABASE_URL` | Neon → reset wachtwoord → secret bijwerken | korte onderbreking |

### 2.4 Deploy en terugdraaien
- Elke push naar `main` doorloopt CI (lint, typecheck, unit tests, build). Deploy: `npm run build && npx wrangler deploy`.
- **Terugdraaien:** Cloudflare dashboard → Workers → *sieradenkoningin* → *Deployments* → vorige versie → **Rollback**; of `npx wrangler rollback`.
- Databasemigraties zijn vooruit-compatibel; draai `npm run db:migrate` vóór de deploy. Een migratie terugdraaien = herstellen naar een Neon-branch van vóór de migratie (§2.7).

### 2.5 Geplande taken (cron)
`cloudflare/worker.js` roept via Cron Triggers `/api/jobs` aan (beveiligd met `CRON_SECRET`): elke 5 minuten verlopen voorraadreservaties vrijgeven, onbetaalde bestellingen laten verlopen, wachtrij-taken (e-mails, facturen, back-in-stock, media opruimen) uitvoeren; dagelijks sessies en oude winkelmandjes opruimen. Controle: *Instellingen → E-mails* toont verzonden mails; mislukte taken worden tot 5 keer opnieuw geprobeerd.

### 2.6 Noodtoegang beheer
Met databanktoegang (laptop met de repo en `.env` met de productie-`DATABASE_URL`):
```
npm run admin:reset -- eigenaar@domein.be          # nieuw wachtwoord + 2FA opnieuw instellen
npm run admin:reset -- eigenaar@domein.be --keep-2fa
```
Het nieuwe wachtwoord wordt één keer getoond; de persoon wordt overal uitgelogd en de actie komt in de auditlog.

### 2.7 Back-ups en herstel
- Neon bewaart een **point-in-time history** (PITR). Herstel = in Neon een **branch** maken op een tijdstip van vóór het probleem, controleren, en dan de `DATABASE_URL` naar die branch laten wijzen (of de branch tot hoofdbranch promoveren).
- Dagelijkse logische export naar de opslag (P5-04). Herstel-oefening: zie §12 van `EXECUTION_PLAN.md`.

### 2.8 Bewaking
- **Uptime:** `GET /api/health` → 200 met `{"ok":true,"db":"up"}`; 503 als de database onbereikbaar is. Stel een uptime-check in (bv. elke minuut).
- **Fouten:** Sentry (indien `SENTRY_DSN` gezet).
- **Logs:** Cloudflare → Workers → Logs (observability staat aan).

### 2.9 Lokale ontwikkeling
Zie `CLAUDE.md` (lokale Postgres op poort 54329, `npm run db:migrate && npm run db:seed`, `npm run dev`). De seed maakt 24 **DEMO**-producten; gebruik voor productie `npm run db:seed -- --no-demo`.
