<?php
/**
 * sqler_test_real_schema.php
 * Zaawansowany test SQLera oparty na REALNYM schemacie z dumpa `server135179_set4`
 * (system eventowy: Uczestnik, Sprzedaz, Faktura, Event, Agenda, Hotel, Grupa...)
 *
 * Kluczowe tabele wykorzystane niżej (z prawdziwymi kolumnami z dumpa):
 * - Uczestnik (imie, nazwisko, email, krajId, typId, status, dataDodania...)
 * - Kraj (nazwa, alpha2, alpha3)
 * - Sprzedaz (klientId, sprzedazFormaPlatnosciId, wartoscNetto, wartoscBrutto, fv, status)
 * - SprzedazPozycja (sprzedazId, sprzedazTowarId, uczestnikId, ilosc, cenaNetto, wartoscBrutto)
 * - SprzedazTowar (nazwa, cenaNetto, cenaBrutto, sprzedazTowarGrupaId, limitSprzedazy)
 * - Faktura / FakturaPozycja (numerCaly, klientId, zaplacone, wartoscNetto/wartoscBrutto)
 * - Event / EventUczestnik / EventObecnosc
 * - AgendaPanel / AgendaSekcja / AgendaPanelUczestnik
 * - Hotel / HotelUczestnik / HotelPokojTyp
 * - Grupa / GrupaUczestnik
 * - Uzytkownik (operatorzy systemu — do audytu)
 */

// -----------------------------------------------------------------
// 1. Podstawowy SELECT z aliasem — test autocomplete na kolumnach Uczestnik
// -----------------------------------------------------------------
$sql1 = "
    SELECT u.id, u.imie, u.nazwisko, u.email, u.firma
    FROM Uczestnik u
    WHERE u.status = 1
";

// -----------------------------------------------------------------
// 2. JOIN wielotabelowy — uczestnik + kraj + typ + agenda (LEFT/INNER mieszane)
// -----------------------------------------------------------------
$sql2 = "
    SELECT
        u.id,
        u.imie,
        u.nazwisko,
        k.nazwaPubliczna AS kraj,
        k.alpha2,
        ut.nazwa AS typUczestnika,
        ap.nazwa AS panel,
        aps.nazwa AS sekcja
    FROM Uczestnik u
    INNER JOIN Kraj k ON k.id = u.krajId
    LEFT JOIN UczestnikTyp ut ON ut.id = u.typId
    LEFT JOIN AgendaPanelUczestnik apu ON apu.uczestnikId = u.id
    LEFT JOIN AgendaPanel ap ON ap.id = apu.agendaPanelId
    LEFT JOIN AgendaSekcja aps ON aps.id = ap.agendaSekcjaId
    WHERE u.status = 1
      AND ap.widocznosc = 1
    ORDER BY u.nazwisko, u.imie
";

// -----------------------------------------------------------------
// 3. Sprzedaż z pozycjami i towarami — GROUP BY + agregaty + HAVING
// -----------------------------------------------------------------
$sql3 = "
    SELECT
        s.id AS sprzedazId,
        u.imie,
        u.nazwisko,
        COUNT(sp.id) AS liczbaPozycji,
        SUM(sp.wartoscNetto) AS sumaNetto,
        SUM(sp.wartoscBrutto) AS sumaBrutto,
        SUM(sp.kwotaVat) AS sumaVat
    FROM Sprzedaz s
    INNER JOIN SprzedazPozycja sp ON sp.sprzedazId = s.id
    LEFT JOIN Uczestnik u ON u.id = sp.uczestnikId
    WHERE s.status = 1
    GROUP BY s.id, u.imie, u.nazwisko
    HAVING SUM(sp.wartoscBrutto) > 500
    ORDER BY sumaBrutto DESC
";

// -----------------------------------------------------------------
// 4. Subquery skorelowana + EXISTS — uczestnicy z opłaconą fakturą
// -----------------------------------------------------------------
$sql4 = "
    SELECT u.id, u.imie, u.nazwisko, u.email
    FROM Uczestnik u
    WHERE EXISTS (
        SELECT 1
        FROM SprzedazPozycja sp
        INNER JOIN Sprzedaz s ON s.id = sp.sprzedazId
        INNER JOIN Faktura f ON f.sprzedazId = s.id
        WHERE sp.uczestnikId = u.id AND f.zaplacone = 1
    )
    AND NOT EXISTS (
        SELECT 1 FROM AgendaPanelWykluczenia apw
        WHERE apw.agendaPanelIdWykluczajaca = u.id
    )
";

// -----------------------------------------------------------------
// 5. CTE rekurencyjne — sekcje agendy w kolejności (drzewiasty porządek godzinowy)
// -----------------------------------------------------------------
$sql5 = "
    WITH RECURSIVE panel_kolejnosc AS (
        SELECT id, nazwa, agendaSekcjaId, kolejnosc, 1 AS poziom
        FROM AgendaPanel
        WHERE status = 1

        UNION ALL

        SELECT ap.id, ap.nazwa, ap.agendaSekcjaId, ap.kolejnosc, pk.poziom + 1
        FROM AgendaPanel ap
        INNER JOIN panel_kolejnosc pk ON ap.agendaSekcjaId = pk.agendaSekcjaId AND ap.kolejnosc > pk.kolejnosc
    )
    SELECT * FROM panel_kolejnosc ORDER BY agendaSekcjaId, kolejnosc
";

// -----------------------------------------------------------------
// 6. Window functions — ranking sprzedaży towarów per grupa
// -----------------------------------------------------------------
$sql6 = "
    SELECT
        st.id,
        st.nazwa,
        stg.nazwa AS grupaTowaru,
        SUM(sp.ilosc) AS sztukSprzedanych,
        SUM(sp.wartoscBrutto) AS przychodBrutto,
        RANK() OVER (PARTITION BY st.sprzedazTowarGrupaId ORDER BY SUM(sp.wartoscBrutto) DESC) AS rankingWGrupie,
        ROW_NUMBER() OVER (ORDER BY SUM(sp.wartoscBrutto) DESC) AS rankingGlobalny,
        SUM(sp.wartoscBrutto) OVER (PARTITION BY st.sprzedazTowarGrupaId) AS sumaGrupy,
        LAG(SUM(sp.wartoscBrutto)) OVER (ORDER BY st.dataDodania) AS poprzedniPrzychod
    FROM SprzedazTowar st
    INNER JOIN SprzedazPozycja sp ON sp.sprzedazTowarId = st.id
    LEFT JOIN SprzedazTowarGrupa stg ON stg.id = st.sprzedazTowarGrupaId
    WHERE st.status = 1
    GROUP BY st.id, st.nazwa, stg.nazwa, st.sprzedazTowarGrupaId, st.dataDodania
";

// -----------------------------------------------------------------
// 7. CASE WHEN + funkcje tekstowe/daty — segmentacja uczestników
// -----------------------------------------------------------------
$sql7 = "
    SELECT
        u.id,
        CONCAT(u.imie, ' ', u.nazwisko) AS pelneImie,
        DATEDIFF(NOW(), u.dataRejestracji) AS dniOdRejestracji,
        CASE
            WHEN u.plec = 1 THEN 'Kobieta'
            WHEN u.plec = 2 THEN 'Mężczyzna'
            ELSE 'Nie podano'
        END AS plecOpisowo,
        CASE
            WHEN u.nocleg = 1 AND u.transportId IS NOT NULL THEN 'Pełny pakiet'
            WHEN u.nocleg = 1 THEN 'Tylko nocleg'
            WHEN u.transportId IS NOT NULL THEN 'Tylko transport'
            ELSE 'Bez dodatków'
        END AS pakiet,
        IFNULL(u.miasto, 'Brak danych') AS miasto,
        DATE_FORMAT(u.dataRejestracji, '%d-%m-%Y') AS dataRejestracjiFormat
    FROM Uczestnik u
    WHERE u.status IN (1, 2)
    ORDER BY dniOdRejestracji DESC
";

// -----------------------------------------------------------------
// 8. UNION — uczestnicy z hotelami vs uczestnicy bez hoteli, wspólna lista raportowa
// -----------------------------------------------------------------
$sql8 = "
    SELECT u.id, u.imie, u.nazwisko, 'z_hotelem' AS grupaRaportu
    FROM Uczestnik u
    INNER JOIN HotelUczestnik hu ON hu.uczestnikId = u.id
    WHERE hu.status = 1

    UNION ALL

    SELECT u.id, u.imie, u.nazwisko, 'bez_hotelu' AS grupaRaportu
    FROM Uczestnik u
    WHERE NOT EXISTS (
        SELECT 1 FROM HotelUczestnik hu2 WHERE hu2.uczestnikId = u.id AND hu2.status = 1
    )
"; 

// -----------------------------------------------------------------
// 9. Faktury z pozycjami — JOIN + subquery skalarna w SELECT
// -----------------------------------------------------------------
$sql9 = "
    SELECT
        f.id,
        f.numerCaly,
        f.nazwaNabywca,
        f.dataWystawienia,
        f.zaplacone,
        (
            SELECT SUM(fp.wartoscBrutto)
            FROM FakturaPozycja fp
            WHERE fp.fakturaId = f.id AND fp.status = 1
        ) AS sumaBruttoPozycji,
        (
            SELECT COUNT(*)
            FROM FakturaPozycja fp2
            WHERE fp2.fakturaId = f.id
        ) AS liczbaPozycji
    FROM Faktura f
    WHERE f.status = 1
      AND f.dataWystawienia BETWEEN '2026-01-01' AND '2026-12-31'
    ORDER BY f.dataWystawienia DESC
";

// -----------------------------------------------------------------
// 10. UPDATE z wielotabelowym JOIN — oznaczenie sprzedaży jako zafakturowanej
// -----------------------------------------------------------------
$sql10 = "
    UPDATE Sprzedaz s
    INNER JOIN Faktura f ON f.sprzedazId = s.id
    SET s.fv = 1
    WHERE f.zaplacone = 1 AND s.status = 1 AND f.id = :faktura_id
";

// -----------------------------------------------------------------
// 11. INSERT ... SELECT — kopiowanie uczestnika do grupy po rejestracji
// -----------------------------------------------------------------
$sql11 = "
    INSERT INTO GrupaUczestnik (grupaId, uczestnikId, kolejnosc, status)
    SELECT :grupa_id, u.id, 1, 1
    FROM Uczestnik u
    WHERE u.id = :uczestnik_id
    ON DUPLICATE KEY UPDATE kolejnosc = kolejnosc + 1
";

// -----------------------------------------------------------------
// 12. DELETE z warunkiem opartym o subquery — czyszczenie starych logów
// -----------------------------------------------------------------
$sql12 = "
    DELETE FROM UczestnikLogi
    WHERE uczestnikId IN (
        SELECT id FROM Uczestnik WHERE status = 0
    )
    AND dataDodania < DATE_SUB(NOW(), INTERVAL 2 YEAR)
    LIMIT 1000
";

// -----------------------------------------------------------------
// 13. Self-join — uczestnicy i ich opiekunowie (opiekunId wskazuje na Uczestnik.id)
// -----------------------------------------------------------------
$sql13 = "
    SELECT
        podopieczny.id,
        podopieczny.imie AS imieUczestnika,
        podopieczny.nazwisko AS nazwiskoUczestnika,
        opiekun.imie AS imieOpiekuna,
        opiekun.nazwisko AS nazwiskoOpiekuna
    FROM Uczestnik podopieczny
    LEFT JOIN Uczestnik opiekun ON opiekun.id = podopieczny.opiekunId
    WHERE podopieczny.opiekunId > 0
";

// -----------------------------------------------------------------
// 14. Heredoc — hotel i pokoje z liczbą współlokatorów
// -----------------------------------------------------------------
$sql14 = <<<SQL
    SELECT
        h.nazwa AS hotel,
        hpt.nazwa AS typPokoju,
        hpt.iloscOsob,
        COUNT(hu.id) AS liczbaUczestnikow
    FROM Hotel h
    INNER JOIN HotelUczestnik hu ON hu.hotelId = h.id
    INNER JOIN HotelPokojTyp hpt ON hpt.id = hu.hotelPokojTypId
    WHERE h.status = 1 AND hu.status = 1
    GROUP BY h.id, h.nazwa, hpt.id, hpt.nazwa, hpt.iloscOsob
    ORDER BY h.nazwa
SQL;

// -----------------------------------------------------------------
// 15. Interpolacja zmiennych PHP w zapytaniu dynamicznym
// -----------------------------------------------------------------
$eventId = 12;
$statusAktywny = 1;
$sql15 = "
    SELECT u.id, u.imie, u.nazwisko, eu.opis
    FROM Uczestnik u
    INNER JOIN EventUczestnik eu ON eu.uczestnikId = u.id
    WHERE eu.eventId = {$eventId}
      AND u.status = {$statusAktywny}
    ORDER BY u.nazwisko
";

// -----------------------------------------------------------------
// 16. Prepared statement z nazwanymi parametrami — logowanie wejść na event
// -----------------------------------------------------------------
$stmt = $pdo->prepare("
    SELECT ee.id, u.imie, u.nazwisko, ee.dataWejscia, ee.dataWyjscia
    FROM EventEwidencja ee
    INNER JOIN Uczestnik u ON u.id = ee.uczestnikId
    WHERE ee.eventId = :event_id
      AND ee.dataWejscia >= :data_od
    ORDER BY ee.dataWejscia DESC
");
$stmt->bindValue(':event_id', $eventId, PDO::PARAM_INT);
$stmt->bindValue(':data_od', '2026-01-01 00:00:00', PDO::PARAM_STR);
$stmt->execute();

// -----------------------------------------------------------------
// 17. Celowy błąd — literówki w nazwach tabel/kolumn (test diagnostyki SQLera)
// -----------------------------------------------------------------
$sql17_broken = "
    SELECT u.imieee, u.nazwiskko
    FROM Uczestnikk u
    WHERE u.statuss = 1
";

// -----------------------------------------------------------------
// 18. Wielopoziomowy subquery + window function — TOP 10 najhojniejszych klientów
// -----------------------------------------------------------------
$sql18 = "
    SELECT * FROM (
        SELECT
            k.id,
            k.imie,
            k.nazwisko,
            k.firma,
            SUM(s.wartoscBrutto) AS sumaZakupow,
            DENSE_RANK() OVER (ORDER BY SUM(s.wartoscBrutto) DESC) AS pozycjaRankingu
        FROM Klient k
        INNER JOIN Sprzedaz s ON s.klientId = k.id
        WHERE s.status = 1
        GROUP BY k.id, k.imie, k.nazwisko, k.firma
    ) ranking
    WHERE ranking.pozycjaRankingu <= 10
";

// -----------------------------------------------------------------
// 19. ALTER / DDL w kontekście PHP (np. skrypt migracyjny) — test DDL parsera
// -----------------------------------------------------------------
$sqlDdl = "
    ALTER TABLE Uczestnik
    ADD COLUMN kodQr VARCHAR(64) DEFAULT NULL AFTER kodKreskowy,
    ADD INDEX idx_kod_qr (kodQr)
";

// -----------------------------------------------------------------
// 20. Wielotabelowy raport finansowy — Sprzedaz + Faktura + FormaPlatnosci + Sprzedawca
// -----------------------------------------------------------------
$sql20 = "
    SELECT
        sf.nazwa AS formaPlatnosci,
        ss.nazwa AS sprzedawca,
        COUNT(DISTINCT s.id) AS liczbaTransakcji,
        SUM(s.wartoscNetto) AS sumaNetto,
        SUM(s.kwotaVat) AS sumaVat,
        SUM(s.wartoscBrutto) AS sumaBrutto,
        AVG(s.wartoscBrutto) AS sredniaWartoscTransakcji
    FROM Sprzedaz s
    INNER JOIN SprzedazFormaPlatnosci sf ON sf.id = s.sprzedazFormaPlatnosciId
    LEFT JOIN Faktura f ON f.sprzedazId = s.id
    LEFT JOIN SprzedazSprzedawca ss ON ss.id = f.sprzedazSprzedawcaId
    WHERE s.status = 1
      AND s.dataDodania BETWEEN :data_od AND :data_do
    GROUP BY sf.id, sf.nazwa, ss.id, ss.nazwa
    HAVING SUM(s.wartoscBrutto) > 0
    ORDER BY sumaBrutto DESC
";