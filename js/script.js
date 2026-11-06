/* ============================================================
   GESTIONALE PRIVATO — script.js (VERSIONE DEMO)
   Demo statica per il portfolio: niente server e niente database.
   I dati di partenza arrivano da js/data.js (defaultState) e le
   modifiche restano solo in questo browser, nel localStorage
   (chiave 'nailsapp-demo-v1'). Il PIN è 1234.
   L'app vera usa PHP e MySQL (api/index.php): qui il codice della
   sincronizzazione resta, ma è spento (CONFIG.api = '').
   JavaScript vanilla ES6+, zero dipendenze.
   ------------------------------------------------------------
   IMPIANTO
   Ogni schermata mostra poco e chiaro. Le righe degli elenchi non
   contengono comandi: si toccano e si apre un pannello con tutto
   dentro. Così l'agenda resta leggibile a colpo d'occhio e le
   azioni hanno bersagli grandi.
   ------------------------------------------------------------
   INDICE
   01. Configurazione, listino, categorie
   02. Utility (date, testo, telefono, numeri)
   03. Archivio in memoria (solo il PIN resta sul telefono)
   03bis. Sincronizzazione col database
   04. Anagrafica clienti
   05. Appuntamenti e controllo sovrapposizioni
   06. Spese e guadagni
   07. Bilancio (calcoli)
   08. Telefono, WhatsApp, mappe, calendario (.ics)
   09. UI: toast, pannelli, blocco schermo, tastierino
   10. Rendering delle schermate
   11. Pannelli: appuntamento, cliente, spesa, impostazioni
   12. File e resoconti
   13. Bootstrap
   ============================================================ */
'use strict';

/* ============================================================
   01. CONFIGURAZIONE
   ============================================================ */

const CONFIG = {
  /* Demo: chiave versionata, diversa da quella dell'app vera
     ('ariannaApp.db.v1'), così le due non si pestano i piedi. */
  storageKey: 'nailsapp-demo-v1',
  defaultPin: '1234',
  countryCode: '39',
  /* Demo: il blocco per inattività è spento (vedi resetIdle). Questo
     valore decide solo per quanto, ricaricando la pagina, si rientra
     senza ridigitare il PIN. */
  autoLockMinutes: 15,
  upcomingCount: 12,       // quanti appuntamenti mostra la Home
  /* Nome del saluto in Home. */
  nome: 'Arianna',

  /* Dove sta l'API che parla col database (api/index.php, PHP + PDO).
     Indirizzi relativi: l'app è una pagina sola (nella demo app.html), e api/
     le sta accanto.
     Svuotare `api` ('') spegne la sincronizzazione e l'app lavora
     tutta e sola nel browser, sul localStorage.
     Su GitHub Pages (e aprendo il file dal disco) il PHP non gira:
     lì si spegne da sola, e i dati restano solo in questo browser. */
  /* Demo: sempre spenta, anche da Laragon. Nessuna chiamata parte. */
  api: '',

  /* Dove si apre e si chiude la sessione col server. Nella demo
     restano vuoti: accedi() ed esci() non chiamano niente. */
  accesso: '',
  esci: '',

  /* Quanto si aspetta, dopo l'ultima modifica, prima di mandare
     l'archivio al server. Mentre si compila un appuntamento il
     salvataggio scatta molte volte di fila: questa pausa fa sì
     che parta un invio solo, alla fine. */
  syncRitardo: 400
};

/* Listino iniziale: copiato nell'archivio al primo avvio, poi
   modificabile da Impostazioni → Listino. `attivo` decide se la voce
   compare nel menu servizi. */
const DEFAULT_SERVICES = [
  { id: 'manicure',      nome: 'Manicure estetica',            durata: 40,  prezzo: 20, attivo: true },
  { id: 'semi-mani',     nome: 'Semipermanente mani',          durata: 60,  prezzo: 30, attivo: true },
  { id: 'gel-cover',     nome: 'Copertura in gel su naturale', durata: 75,  prezzo: 40, attivo: true },
  { id: 'ricostruzione', nome: 'Ricostruzione completa',       durata: 120, prezzo: 55, attivo: true },
  { id: 'refill',        nome: 'Refill / riequilibratura',     durata: 90,  prezzo: 45, attivo: true },
  { id: 'pedicure',      nome: 'Pedicure estetico',            durata: 50,  prezzo: 28, attivo: true },
  { id: 'semi-piedi',    nome: 'Semipermanente piedi',         durata: 60,  prezzo: 35, attivo: true },
  { id: 'nailart',       nome: 'Nail art (a unghia)',          durata: 15,  prezzo: 5,  attivo: true },
  { id: 'rimozione',     nome: 'Rimozione lavoro esterno',     durata: 30,  prezzo: 10, attivo: true },
  { id: 'riparazione',   nome: 'Riparazione singola unghia',   durata: 20,  prezzo: 8,  attivo: true },
  { id: 'altro',         nome: 'Altro / personalizzato',       durata: 60,  prezzo: 0,  attivo: true }
];

/*
  Due soli stati. Un appuntamento o è ancora aperto, o è stato fatto —
  e nel momento in cui lo segni fatto il suo prezzo entra da solo negli
  incassi e nel grafico. Il vecchio "Confermato" stava in mezzo senza
  cambiare niente nei conti, e obbligava a un passaggio in più.
*/
const STATI = {
  wait: { label: 'Da completare' },
  done: { label: 'Completato' }
};

/* Le categorie di spese e guadagni non sono più fisse nel codice: le
   gestisce Arianna da Impostazioni, come i Negozi. Qui restano solo
   quelle di partenza, usate quando l'archivio non ne ha ancora.
   I guadagni non passano dall'agenda: i trattamenti in agenda entrano
   da soli quando l'appuntamento è segnato completato. */
const DEFAULT_CATEGORIE_SPESE = ['Attrezzatura'];
const DEFAULT_CATEGORIE_ENTRATE = ['Babysitter', 'Trattamento mani', 'Trattamento piedi', 'Trattamento mani e piedi'];

/* Come si paga: si sceglie quando un appuntamento si segna completato e
   nel modulo guadagno. Arianna li gestisce da Impostazioni, come le
   categorie. */
const DEFAULT_METODI_PAGAMENTO = ['Contanti', 'Bonifico', 'PayPal', 'Satispay'];

/* Prima la categoria si salvava come codice ('mancia'); adesso si salva
   il nome per esteso, lo stesso che si sceglie dal menu. Questa tabella
   converte i codici di prima, una volta sola, quando l'archivio arriva.
   Una spesa o un guadagno di una categoria non più in elenco resta col
   suo nome: non sparisce, solo quel nome non si ripropone nel menu. */
const CATEGORIE_VECCHIE = {
  prodotti: 'Prodotti', attrezzatura: 'Attrezzatura', formazione: 'Corsi e formazione',
  monouso: 'Monouso e igiene', affitto: 'Spazio e utenze',
  vendita: 'Vendita prodotti', buono: 'Buono regalo', trattamento: 'Trattamento fuori agenda',
  mancia: 'Mancia', altro: 'Altro'
};

function migraCategoria(valore) {
  const s = String(valore || '').trim();
  return CATEGORIE_VECCHIE[s] || s;
}

/* Suggerimenti sotto la descrizione, per categoria (spese e guadagni).
   A questi si aggiungono quelli già scritti altre volte nella stessa
   categoria, i più usati per primi. */
const SUGGERIMENTI = {
  'Attrezzatura':             ['Lampada UV/LED', 'Fresa e punte', 'Lime e buffer', 'Pennelli', 'Poggiamano', 'Aspiratore polveri'],
  'Prodotti':                 ['Smalti semipermanenti', 'Gel costruttore', 'Base e top coat', 'Acrygel', 'Primer e dehydrator', 'Cleaner e remover', 'Decorazioni nail art'],
  'Monouso e igiene':         ['Guanti', 'Salviette e carta', 'Disinfettante', 'Mascherine', 'Cotone e dischetti', 'Tips e cartine'],
  'Babysitter':               ['Serata', 'Pomeriggio', 'Mezza giornata', 'Giornata intera'],
  'Trattamento mani':         ['Manicure', 'Semipermanente mani', 'Ricostruzione', 'Refill'],
  'Trattamento piedi':        ['Pedicure', 'Semipermanente piedi'],
  'Trattamento mani e piedi': ['Semipermanente mani e piedi', 'Manicure e pedicure']
};

/* Durate proponibili, a passi di cinque minuti dove serve e più larghi
   dove nessuno lavora al minuto. Una durata fuori elenco — arrivata da
   un archivio importato — viene aggiunta al volo, così la modifica non
   la cambia sotto il naso. */
const DURATE = [10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 240];

/* Sotto la mezz'ora un appuntamento normale non si prende: le durate
   più corte, e i buchi più stretti, valgono solo per un ritocco veloce
   (una sola unghia, chiesto dalla cliente). Vale anche per i ritagli:
   un orario che lascia prima o dopo di sé meno di questo non si
   propone, perché quel pezzetto non lo userebbe più nessuno. */
const DURATA_MINIMA = 30;

/* Ogni quanto si propone un orario dentro una fascia libera. Inizio e
   fine della fascia si propongono sempre, anche fuori passo. */
const PASSO_SLOT = 30;

/* Ogni giorno ha tre fasce, mattina, pomeriggio e sera, ognuna accesa o
   spenta con i suoi orari. Un giorno con tutte e tre spente è chiuso. */
const FASCE = [
  { id: 'mattina',    nome: 'Mattina' },
  { id: 'pomeriggio', nome: 'Pomeriggio' },
  { id: 'sera',       nome: 'Sera' }
];
const fascia = (attivo, da, a) => ({ attivo, da, a });
const giornata = (m, p, s) => ({ mattina: m, pomeriggio: p, sera: s });

/* Orari di lavoro di partenza, per giorno della settimana (0 = domenica,
   come Date.getDay). Si cambiano da Impostazioni → Orari di lavoro. */
const DEFAULT_ORARI = {
  1: giornata(fascia(false, '09:00', '13:00'), fascia(true,  '14:30', '18:00'), fascia(true,  '18:00', '20:30')),
  2: giornata(fascia(true,  '09:00', '13:00'), fascia(true,  '14:00', '18:00'), fascia(false, '18:00', '21:00')),
  3: giornata(fascia(true,  '09:00', '13:00'), fascia(true,  '14:00', '18:00'), fascia(false, '18:00', '21:00')),
  4: giornata(fascia(true,  '09:00', '13:00'), fascia(true,  '14:00', '18:00'), fascia(false, '18:00', '21:00')),
  5: giornata(fascia(true,  '09:00', '13:00'), fascia(true,  '14:00', '18:00'), fascia(false, '18:00', '21:00')),
  6: giornata(fascia(true,  '09:00', '13:00'), fascia(false, '14:00', '18:00'), fascia(false, '18:00', '21:00')),
  0: giornata(fascia(false, '09:00', '13:00'), fascia(false, '14:00', '18:00'), fascia(false, '18:00', '21:00'))
};
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
/* L'ordine in cui si leggono: la settimana lavorativa parte dal lunedì. */
const ORDINE_GIORNI = [1, 2, 3, 4, 5, 6, 0];

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                     'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/* Stato dell'interfaccia (non persistito). */
const state = {
  selected: toKey(new Date()),
  month: startOfMonth(new Date()),
  clientQuery: '',
  expenseMonth: 'all',
  incomeMonth: 'all',
  viewIncomeId: null,
  year: new Date().getFullYear(),
  unlocked: false,
  pendingSave: null,
  viewApptId: null,
  viewClientId: null,
  viewExpenseId: null
};

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* Dove eravamo rimasti in agenda: il giorno scelto e il mese a schermo.
   Sta in sessionStorage di proposito, non in localStorage: così
   ricaricando la pagina mentre si inseriscono dati vecchi l'agenda resta
   sul mese dove si stava lavorando, ma chiudendo e riaprendo l'app si
   riparte dal mese corrente — altrimenti ogni volta si dovrebbe tornare
   a oggi a mano. sessionStorage sopravvive al refresh e si azzera alla
   chiusura. Il pulsante "Oggi" riporta comunque al giorno corrente. */
const CHIAVE_VISTA = CONFIG.storageKey + '.vista';

function segnaVista() {
  try {
    sessionStorage.setItem(CHIAVE_VISTA, JSON.stringify({
      selected: state.selected,
      month: toKey(state.month)
    }));
  } catch (_) { /* senza spazio pazienza: riparte da oggi */ }
}

function ripristinaVista() {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHIAVE_VISTA) || 'null');
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v.selected) && /^\d{4}-\d{2}-\d{2}$/.test(v.month)) {
      state.selected = v.selected;
      state.month = startOfMonth(fromKey(v.month));
    }
  } catch (_) { /* illeggibile: si resta su oggi */ }
}

/* ============================================================
   02. UTILITY
   ============================================================ */

function uid(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Id numerico per clienti, appuntamenti, spese e guadagni: il numero
 * dopo il più alto dell'elenco ("1", "2", "3"…). Resta una stringa,
 * come gli id che l'app confronta coi valori letti dall'HTML. Il
 * database ne controlla l'unicità: due dispositivi che scrivono
 * insieme li ferma il numero di revisione (vince il database).
 */
function nuovoId(elenco) {
  const max = elenco.reduce((m, x) => {
    const id = String(x && x.id);
    return /^\d+$/.test(id) ? Math.max(m, Number(id)) : m;
  }, 0);
  return String(max + 1);
}

/** Chiave data locale YYYY-MM-DD (niente toISOString: slitterebbe di fuso). */
function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Lunedì della settimana che contiene `date`. */
function startOfWeek(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** Prefisso YYYY-MM di un mese (0-based). */
function monthPrefix(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function toHHMM(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

/** Ora di fine: inizio + durata. */
function endTime(appt) {
  return toHHMM(toMinutes(appt.ora) + Number(appt.durata || 0));
}

const fmtDayLong  = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDayFull  = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonth    = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
const fmtDayShort = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtDayMini  = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtWeekDay  = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric' });

/** "Oggi", "Domani", oppure "Venerdì 11". */
function etichettaGiorno(dateKey) {
  const oggi = new Date();
  if (dateKey === toKey(oggi)) return 'Oggi';
  if (dateKey === toKey(addDays(oggi, 1))) return 'Domani';
  return capitalize(fmtWeekDay.format(fromKey(dateKey)));
}

/** Valuta con il punto delle migliaia e due decimali: 8.000,00 €.
    `useGrouping: 'always'` serve perché in italiano il punto, da
    solo, comparirebbe solo da 10.000 in su (3300 € invece di 3.300 €). */
const fmtValuta = new Intl.NumberFormat('it-IT', {
  style: 'currency', currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always'
});

function fmtEuro(value) {
  return fmtValuta.format(Number(value) || 0);
}

/** Per le etichette degli assi: valori tondi in poco spazio, 3.000 €. */
const fmtValutaTonda = new Intl.NumberFormat('it-IT', {
  style: 'currency', currency: 'EUR',
  maximumFractionDigits: 0,
  useGrouping: 'always'
});

function fmtEuroTondo(value) {
  return fmtValutaTonda.format(Math.round(Number(value) || 0));
}

/** Con segno esplicito: il netto va letto anche in bianco e nero. */
function fmtSigned(value) {
  const n = Number(value) || 0;
  return (n > 0 ? '+' : n < 0 ? '−' : '') + fmtEuro(Math.abs(n));
}

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function capitalize(text) {
  const s = String(text || '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function sum(list, field) {
  return list.reduce((total, item) => total + (Number(item[field]) || 0), 0);
}

function normPhone(tel) {
  return String(tel || '').replace(/\D/g, '');
}

/**
 * Chiave canonica del telefono in formato internazionale: serve sia per i
 * link wa.me sia per riconoscere la cliente. "333 1234567",
 * "+39 333 1234567" e "0039 3331234567" devono puntare alla stessa scheda,
 * altrimenti l'anagrafica si riempie di doppioni.
 * Lo zero interurbano dei fissi va conservato (+39 0331 …).
 */
function phoneKey(tel) {
  let d = normPhone(tel);
  if (d.startsWith('00')) d = d.slice(2);
  if (!d) return '';
  if (d.length >= 11 && d.startsWith(CONFIG.countryCode)) return d;
  return CONFIG.countryCode + d;
}

/** Offuscamento del PIN: tiene lontani gli sguardi, non un esperto. */
function hashPin(pin) {
  let h = 5381;
  const s = String(pin);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36);
}

/** Passo "tondo" per la scala del grafico (10, 20, 25, 50, 100…). */
function niceStep(raw) {
  const value = Math.max(Number(raw) || 0, 1);
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const mult = [1, 2, 2.5, 5, 10].find(m => value <= pow * m) || 10;
  return pow * mult;
}

/** Iniziali per l'avatar, difensive: un archivio importato può avere buchi. */
function initials(client) {
  return (String(client.nome || '?')[0] + (String(client.cognome || '')[0] || '')).toUpperCase();
}

/* ============================================================
   03. PERSISTENZA
   ============================================================ */

function emptyDB() {
  return {
    version: 1,
    settings: {
      pinHash: hashPin(CONFIG.defaultPin),
      /* Diventa vero la prima volta che il PIN viene cambiato, e non
         torna più indietro: da lì l'app non chiede più di cambiarlo. */
      pinCambiato: false,
      /* Quando il PIN è stato cambiato l'ultima volta. Non si mostra in
         app: serve solo come riferimento tecnico nel database. */
      pinCambiatoIl: null,
      orariLavoro: copiaOrari(DEFAULT_ORARI),
      /* I negozi dove si compra: da qui sceglie il modulo spesa. */
      negozi: null,
      /* Le categorie, gestite da Impostazioni come i negozi. */
      categorieSpese: null,
      categorieEntrate: null,
      metodiPagamento: null
    },
    services: DEFAULT_SERVICES.map(s => Object.assign({}, s)),
    clients: [],
    appointments: [],
    expenses: [],
    incomes: []
  };
}

/** Normalizza un archivio letto da disco contro la struttura corrente. */
function hydrate(parsed) {
  const base = emptyDB();
  /* Anche l'archivio vuoto passa dalla normalizzazione: i campi che
     nascono da altri (i negozi) devono esserci comunque. */
  if (!parsed || typeof parsed !== 'object') parsed = {};

  const arr = (value, fallback) => (Array.isArray(value) ? value.filter(Boolean) : fallback);

  /* I campi vuoti (null) arrivano dal server quando non ha quel dato:
     non devono cancellare i valori di partenza. */
  const settings = Object.assign(base.settings, pulisciNull(parsed.settings));
  settings.orariLavoro = normOrari(settings.orariLavoro);
  settings.negozi = normNegozi(settings.negozi, arr(parsed.expenses, []));
  settings.categorieSpese = normNomi(settings.categorieSpese, DEFAULT_CATEGORIE_SPESE);
  settings.categorieEntrate = normNomi(settings.categorieEntrate, DEFAULT_CATEGORIE_ENTRATE);
  settings.metodiPagamento = normNomi(settings.metodiPagamento, DEFAULT_METODI_PAGAMENTO);
  /* Un PIN già diverso da quello iniziale è stato cambiato, anche se
     l'archivio è di prima che esistesse il segno. */
  if (settings.pinHash && settings.pinHash !== hashPin(CONFIG.defaultPin)) settings.pinCambiato = true;

  const conCategoria = (r) => { if (r && typeof r === 'object') r.categoria = migraCategoria(r.categoria); return r; };

  return allineaAppuntamenti({
    version: base.version,
    settings,
    /* Un listino salvato vince, ma le voci nuove del codice si aggiungono. */
    services: mergeServices(arr(parsed.services, base.services)),
    clients: arr(parsed.clients, []).map(normIndirizzo),
    appointments: arr(parsed.appointments, []).map(a => normAggiuntivi(normStato(a))),
    expenses: arr(parsed.expenses, []).map(conCategoria),
    /* Il guadagno nato da un appuntamento completato porta il suo id
       (`appuntamentoId`); quelli a mano lo hanno vuoto. */
    incomes: arr(parsed.incomes, []).map(conCategoria).map(i => {
      if (i && typeof i === 'object') {
        i.metodo = String(i.metodo || '');
        i.appuntamentoId = i.appuntamentoId ? String(i.appuntamentoId) : '';
      }
      return i;
    })
  });
}

/**
 * La scheda è l'unica fonte di nome, cognome e telefono: ogni
 * appuntamento collegato li riprende da lì. Prima se ne teneva una
 * copia presa il giorno della prenotazione, e correggendo la scheda
 * gli appuntamenti vecchi restavano col numero a metà — o con
 * "Senza nome", quando la copia era vuota.
 * Gli appuntamenti senza scheda (cancellata su richiesta) tengono
 * quello che hanno.
 */
function allineaAppuntamenti(archivio) {
  const perId = new Map(archivio.clients.map(c => [c.id, c]));
  archivio.appointments.forEach(a => {
    const c = perId.get(a.clientId);
    if (!c) return;
    a.nome = c.nome || '';
    a.cognome = c.cognome || '';
    a.telefono = c.telefono || '';
  });
  return archivio;
}

/* --- Indirizzo in campi -----------------------------------
   Via, civico, CAP, città e provincia stanno separati; `indirizzo`
   resta e porta la riga intera già composta, che è quella che
   leggono Mappa, il calendario e le versioni precedenti. */
const CAMPI_INDIRIZZO = ['via', 'civico', 'cap', 'citta', 'provincia'];

/** "Via Roma 12, 20121 Milano (MI)": solo i pezzi che ci sono. */
function componiIndirizzo(c) {
  const strada = [c.via, c.civico].map(x => String(x || '').trim()).filter(Boolean).join(' ');
  const luogo = [c.cap, c.citta].map(x => String(x || '').trim()).filter(Boolean).join(' ');
  const prov = String(c.provincia || '').trim();
  return [strada, luogo + (prov ? ` (${prov.toUpperCase()})` : '')]
    .map(s => s.trim()).filter(Boolean).join(', ');
}

/**
 * Una scheda di prima ha l'indirizzo in un campo solo: finisce tutto
 * in "Via", così com'era. Spezzarlo da solo in via, civico e città
 * vorrebbe dire indovinare, e un indirizzo sbagliato porta la Mappa
 * nel posto sbagliato.
 */
function normIndirizzo(c) {
  if (!c || typeof c !== 'object') return c;
  CAMPI_INDIRIZZO.forEach(k => { c[k] = String(c[k] || '').trim(); });
  if (!CAMPI_INDIRIZZO.some(k => c[k]) && String(c.indirizzo || '').trim()) {
    c.via = String(c.indirizzo).trim();
  }
  c.indirizzo = componiIndirizzo(c);
  return c;
}

/**
 * L'elenco dei negozi: nomi puliti, senza doppioni. La prima volta che
 * non c'è ancora, nasce da Amazon più i negozi già scritti nelle spese
 * passate, così chi aggiorna l'app non riparte da un elenco vuoto.
 */
/** Nomi puliti, senza doppioni (confronto senza maiuscole). Se la lista
    non c'è ancora, parte da `fallback`. Base di negozi e categorie. */
function normNomi(lista, fallback = []) {
  const elenco = Array.isArray(lista) ? lista : fallback;
  const visti = new Set();
  return elenco.map(n => String(n || '').trim()).filter(n => {
    const k = n.toLowerCase();
    if (!n || visti.has(k)) return false;
    visti.add(k);
    return true;
  });
}

function normNegozi(negozi, spese = []) {
  return normNomi(negozi, ['Amazon', ...spese.map(e => e && e.fornitore)]);
}

function pulisciNull(obj) {
  const out = {};
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(k => { if (obj[k] !== null && obj[k] !== undefined) out[k] = obj[k]; });
  }
  return out;
}

function copiaOrari(orari) {
  return JSON.parse(JSON.stringify(orari));
}

/**
 * Orari letti da un archivio: una fascia mancante o rotta riprende
 * quella di partenza. Gli archivi di prima avevano un orario solo per
 * giorno ({ attivo, da, a }): finisce nella fascia in cui comincia,
 * e le altre due restano spente.
 */
function normOrari(orari) {
  const out = copiaOrari(DEFAULT_ORARI);
  if (!orari || typeof orari !== 'object') return out;
  const valido = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));
  Object.keys(out).forEach(g => {
    const o = orari[g];
    if (!o || typeof o !== 'object') return;
    if ('da' in o) {
      if (!valido(o.da) || !valido(o.a)) return;
      const inizio = toMinutes(o.da);
      const dove = inizio < 13 * 60 ? 'mattina' : inizio < 18 * 60 ? 'pomeriggio' : 'sera';
      FASCE.forEach(f => { out[g][f.id].attivo = false; });
      out[g][dove] = fascia(!!o.attivo, o.da, o.a);
      return;
    }
    FASCE.forEach(f => {
      const x = o[f.id];
      if (x && valido(x.da) && valido(x.a)) out[g][f.id] = fascia(!!x.attivo, x.da, x.a);
    });
  });
  return out;
}

/**
 * Gli archivi scritti quando esisteva anche lo stato "Confermato"
 * riportano `conf`: adesso vale "ancora aperto", cioè `wait`. Senza
 * questa conversione quegli appuntamenti resterebbero in uno stato che
 * l'app non sa più disegnare.
 */
function normStato(appt) {
  if (appt && !(appt.stato in STATI)) appt.stato = 'wait';
  return appt;
}

/**
 * Prestazioni aggiuntive: oltre al servizio principale (`serviceId`),
 * un appuntamento può averne altre, es. piedi insieme a mani. Gli
 * appuntamenti di prima non hanno il campo: partono con l'elenco vuoto.
 */
function normAggiuntivi(appt) {
  if (!appt || typeof appt !== 'object') return appt;
  const ids = Array.isArray(appt.aggiuntivi) ? appt.aggiuntivi.map(String) : [];
  appt.aggiuntivi = [...new Set(ids)].filter(id => id && id !== appt.serviceId);
  return appt;
}

/** "Semipermanente mani + Semipermanente piedi": principale prima, poi le aggiuntive. */
function nomeServizi(service, aggiuntivi) {
  const altri = aggiuntivi.map(id => db.services.find(s => s.id === id)).filter(Boolean);
  return [service, ...altri].map(s => s.nome).join(' + ');
}

function mergeServices(saved) {
  const out = saved.map(s => Object.assign({}, s));
  DEFAULT_SERVICES.forEach(def => {
    if (!out.some(s => s.id === def.id)) out.push(Object.assign({}, def));
  });
  return out;
}

/* I DATI STANNO SOLO NEL DATABASE.
   Sul telefono non resta nessuna copia di clienti, appuntamenti,
   spese o guadagni: l'app li tiene in memoria finché è aperta e li
   rilegge dal database a ogni apertura. Sul telefono resta solo
   l'impronta del PIN (CHIAVE_PIN), che non è un dato delle clienti:
   serve a sbloccare e a riaprire da sola la sessione col server. */
const CHIAVE_PIN = CONFIG.storageKey + '.pin';

function salvaPin() {
  try {
    if (db.settings.pinHash) localStorage.setItem(CHIAVE_PIN, db.settings.pinHash);
  } catch (_) { /* senza spazio si chiede il PIN al server ogni volta */ }
}

/**
 * All'avvio l'archivio è vuoto, col solo PIN. Le versioni di prima
 * tenevano tutto nel localStorage: quella copia si legge un'ultima
 * volta (così le modifiche non ancora arrivate al database possono
 * ancora partire, vedi allineaAllAvvio) e si cancella dal telefono.
 */
/* DEMO — come loadState() di SwapSkills: si legge la chiave
   'nailsapp-demo-v1'; se è vuota o illeggibile si riparte dai dati
   di esempio di js/data.js (defaultState). Il PIN resta sempre 1234. */
function loadDB() {
  let salvato = null;
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw) salvato = JSON.parse(raw);
  } catch (_) { /* storage non disponibile o illeggibile: si riparte dai dati demo */ }

  const archivio = hydrate(salvato && typeof salvato === 'object' ? salvato : defaultState());
  archivio.settings.pinHash = hashPin(CONFIG.defaultPin);
  archivio.settings.pinCambiato = true;   // niente richiesta di cambiare il PIN
  return archivio;
}

/** DEMO — come save() di SwapSkills: tutto nel localStorage di questo browser. */
function saveDB() {
  try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(db)); } catch (_) { /* ignora */ }
  return true;
}

/** DEMO — come resetDemo() di SwapSkills: via la chiave, di nuovo i dati di esempio. */
function resetDemo() {
  try { localStorage.removeItem(CONFIG.storageKey); } catch (_) { /* ignora */ }
  db = loadDB();
  Object.assign(state, {
    selected: toKey(new Date()), month: startOfMonth(new Date()), clientQuery: '',
    expenseMonth: 'all', incomeMonth: 'all', year: new Date().getFullYear()
  });
  renderSelectOptions();
  renderAll();
}

let db = loadDB();

/* ============================================================
   03bis. SINCRONIZZAZIONE COL DATABASE
   ------------------------------------------------------------
   Il localStorage resta il posto dove l'app lavora davvero:
   scrive lì, all'istante, sempre — anche in ascensore, anche
   col telefono in aereo. Il database MySQL è una seconda copia
   che arriva subito dopo, quando la rete c'è.

   È questo l'ordine che tiene in piedi tutto il resto: se il
   server fosse la prima tappa, ogni appuntamento preso senza
   campo andrebbe perso o farebbe aspettare. Così invece non
   aspetta mai niente, e il peggio che può succedere è che la
   copia sul server sia vecchia di qualche minuto.

   LA REVISIONE
   Il server tiene un contatore che sale di uno a ogni
   scrittura. L'app si ricorda a quale numero era arrivata
   l'ultima volta che ha parlato col server. Se i due numeri
   combaciano, le due copie raccontano la stessa storia. Se non
   combaciano, qualcun altro ha scritto nel frattempo — il
   telefono mentre lavoravi dal computer, di solito — e a quel
   punto la scelta di quale copia tenere non la può fare il
   codice da solo: la domanda va fatta a chi sta usando l'app.
   ============================================================ */

const Nuvola = {
  /* Stato mostrato in "Copia online". Cambia nome, non colore:
     il colore lo decide la scheda. */
  stato: CONFIG.api ? 'ignoto' : 'spenta',
  messaggio: CONFIG.api ? 'Non ho ancora parlato col server.' : 'Sincronizzazione spenta.',
  revisione: 0,          // a che punto eravamo l'ultima volta
  ultimo: null,          // quando è riuscita l'ultima sincronizzazione
  daInviare: false,      // ci sono modifiche che il server non ha
  /* I dati in memoria sono completi: arrivati dal database, oppure la
     vecchia copia locale delle versioni di prima (letta una volta sola,
     vedi loadDB), che può ancora avere modifiche da mandare. */
  caricato: haDati(db),
  inCorso: false,
  rimandato: false,      // è arrivata una modifica mentre inviavo
  timer: null
};

/* Il promemoria di dove eravamo rimasti vive accanto
   all'archivio, così sopravvive alla chiusura del browser: senza
   di lui, al riavvio l'app non saprebbe distinguere "il server è
   più avanti" da "io ho modifiche non ancora mandate". */
const CHIAVE_SYNC = CONFIG.storageKey + '.sync';

/* Il segnalibro delle versioni di prima: si legge un'ultima volta,
   insieme alla vecchia copia locale (vedi loadDB), e si cancella. Da
   adesso il numero di revisione vive solo in memoria. */
function leggiSegnalibro() {
  try {
    const raw = localStorage.getItem(CHIAVE_SYNC);
    localStorage.removeItem(CHIAVE_SYNC);
    if (!raw) return;
    const s = JSON.parse(raw);
    Nuvola.revisione = Number(s.revisione) || 0;
    Nuvola.ultimo = s.ultimo || null;
    Nuvola.daInviare = !!s.daInviare;
  } catch (_) { /* segnalibro illeggibile: si riparte dal server */ }
}

/* Niente da scrivere sul telefono: resta per chi la chiama. */
function scriviSegnalibro() {}

leggiSegnalibro();

/* ------------------------------------------------------------
   La sessione col server.
   ------------------------------------------------------------ */

let accessoInCorso = null;   // { pin, promessa }: un solo ingresso per volta
let pinRifiutato = null;     // l'ultimo PIN che il server ha detto sbagliato

/**
 * Apre la sessione col server: manda il PIN ad api/?a=accesso, che
 * lo confronta con quello custodito nel database. Il PIN viaggia
 * già trasformato (è lo stesso valore che l'app tiene in archivio),
 * mai il numero in chiaro.
 *
 * I tentativi sbagliati il server li conta, e dopo cinque si ferma
 * per un quarto d'ora. Per questo un PIN già rifiutato non si
 * rimanda da solo a ogni salvataggio: il telefono col PIN vecchio
 * si chiuderebbe fuori per conto suo. Riprova solo quando lo si
 * digita (`daTastierino`).
 */
function accedi(pin, daTastierino = false) {
  /* Demo: nessun server. */
  if (!CONFIG.api || !CONFIG.accesso) return Promise.reject(new Error('Demo senza server.'));
  if (!daTastierino && pin === pinRifiutato) {
    return Promise.reject(new Error('PIN non riconosciuto.'));
  }
  if (accessoInCorso && accessoInCorso.pin === pin) return accessoInCorso.promessa;

  const controllo = new AbortController();
  const scadenza = setTimeout(() => controllo.abort(), 8000);

  const promessa = fetch(CONFIG.accesso, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
    signal: controllo.signal,
    cache: 'no-store'
  })
    .then(async risposta => {
      const dati = await risposta.json().catch(() => null);
      if (risposta.status === 401) pinRifiutato = pin;
      if (!risposta.ok) {
        throw new Error((dati && dati.errore) || `il server ha risposto ${risposta.status}`);
      }
      if (!dati || dati.ok !== true) throw new Error('il server non ha risposto come mi aspettavo');
      pinRifiutato = null;
      return dati;
    })
    .finally(() => {
      clearTimeout(scadenza);
      if (accessoInCorso && accessoInCorso.promessa === promessa) accessoInCorso = null;
    });

  accessoInCorso = { pin, promessa };
  return promessa;
}

/** Chiude la sessione col server. Senza rete non importa: scade da sola. */
function esci() {
  if (!CONFIG.api || !CONFIG.esci) return;
  fetch(CONFIG.esci, { method: 'POST', cache: 'no-store' }).catch(() => {});
}

/**
 * Una chiamata all'API. A dire chi è l'app è il cookie della
 * sessione aperta con accedi().
 *
 * Se il server risponde 401 la sessione non c'è: scaduta, o mai
 * aperta perché l'app si è riaperta da sola entro i minuti del
 * blocco automatico, senza passare dal tastierino. Si rifà
 * l'accesso col PIN di questo dispositivo e si riprova, una volta.
 *
 * `opzioni.pin` serve in un caso solo: il dispositivo nuovo, che
 * un archivio suo ancora non ce l'ha — vedi recuperaDalDatabase().
 * Lì si entra col PIN appena digitato, prima di chiedere.
 *
 * Il tempo massimo di attesa è corto di proposito: se il server
 * non risponde in pochi secondi, l'app non deve restare
 * appesa. Rinuncia, segna "da inviare" e riprova dopo.
 */
function chiamaApi(azione, opzioni = {}) {
  /* Demo: nessun server. */
  if (!CONFIG.api) return Promise.reject(new Error('Demo senza server.'));
  if (opzioni.pin) {
    return accedi(opzioni.pin, true)
      .then(() => chiamaApi(azione, Object.assign({}, opzioni, { pin: null, riprovata: true })));
  }

  const controllo = new AbortController();
  const scadenza = setTimeout(() => controllo.abort(), opzioni.attesa || 8000);

  return fetch(CONFIG.api + '?a=' + azione, {
    method: opzioni.corpo ? 'POST' : 'GET',
    headers: opzioni.corpo ? { 'Content-Type': 'application/json' } : {},
    body: opzioni.corpo ? JSON.stringify(opzioni.corpo) : undefined,
    signal: controllo.signal,
    cache: 'no-store'
  })
    .then(async risposta => {
      const dati = await risposta.json().catch(() => null);

      /* Il 409 non è un guasto: è il server che dice "fermati,
         qui c'è dell'altro". Torna come risposta normale e lo
         gestisce chi ha chiamato. */
      if (dati && dati.conflitto) return dati;

      if (risposta.status === 401 && !opzioni.riprovata && db.settings.pinHash) {
        await accedi(db.settings.pinHash);
        return chiamaApi(azione, Object.assign({}, opzioni, { riprovata: true }));
      }

      if (!risposta.ok) {
        throw new Error((dati && dati.errore) || `il server ha risposto ${risposta.status}`);
      }

      /* Una risposta "200 OK" che non è il nostro JSON non è una
         risposta: è la pagina di controllo che certi hosting
         mettono davanti al sito, o un errore di PHP finito a
         schermo. Scambiarla per un successo sarebbe il guaio
         peggiore di tutti — l'app segnerebbe "salvato" e
         azzererebbe il contatore delle revisioni, convinta di
         essere allineata a un database che non ha visto. */
      if (!dati || dati.ok !== true) throw new Error('il server non ha risposto come mi aspettavo');

      return dati;
    })
    .finally(() => clearTimeout(scadenza));
}

/**
 * "Non ha funzionato" è vero ma inutile: manda a cercare il
 * guasto a caso. Le tre cose che possono andare storte hanno
 * rimedi diversissimi fra loro, e vale la pena distinguerle.
 */
function spiegaGuasto(err, coda) {
  const m = String((err && err.message) || '');
  if (/troppi tentativi/i.test(m)) {
    return 'Troppi tentativi col PIN sbagliato: il server riapre fra qualche minuto.';
  }
  if (/PIN/i.test(m)) {
    return 'Nella copia online c\'è salvato un PIN diverso da quello di questo telefono.';
  }
  if (/aspettavo/i.test(m)) {
    return 'Il server risponde, ma non come dovrebbe: controlla che PHP sia acceso.';
  }
  return `Server non raggiungibile: ${coda}.`;
}

/* ------------------------------------------------------------
   Invio: dall'app al server.
   ------------------------------------------------------------ */

/**
 * Non parte a ogni tasto premuto. Mentre si compila un
 * appuntamento `saveDB()` scatta più volte di fila; qui si
 * aspetta che le mani si fermino, e poi si manda una volta
 * sola. L'archivio locale intanto è già salvato: il ritardo non
 * mette a rischio niente.
 */
function programmaInvio() {
  if (!CONFIG.api) return;

  Nuvola.daInviare = true;
  scriviSegnalibro();
  disegnaStatoNuvola();

  clearTimeout(Nuvola.timer);
  Nuvola.timer = setTimeout(() => inviaArchivio(), CONFIG.syncRitardo);
}

/* Chiudendo l'app con una modifica ancora in attesa, si manda subito:
   sul telefono non resta da nessuna parte. */
window.addEventListener('pagehide', () => {
  if (Nuvola.daInviare && !Nuvola.inCorso) { clearTimeout(Nuvola.timer); inviaArchivio(); }
});

/**
 * @param {boolean} forza  "i miei dati vincono": salta il
 *   controllo della revisione. Si usa solo dopo che qualcuno ha
 *   risposto a quella domanda.
 */
async function inviaArchivio(forza = false) {
  if (!CONFIG.api) return false;

  /* Una spedizione alla volta. Se ne arriva un'altra mentre la
     prima è per aria, non si accavallano: si segna e si rifà
     subito dopo, con i dati aggiornati. */
  if (Nuvola.inCorso) { Nuvola.rimandato = true; return false; }

  /* PROTEZIONE: finché i dati del database non sono arrivati, in
     memoria c'è un archivio vuoto o incompleto. Mandarlo potrebbe
     svuotare il database: prima si caricano i dati, e la modifica
     parte da lì (allineaAllAvvio, punto 2). */
  if (!Nuvola.caricato) { allineaAllAvvio(); return false; }

  Nuvola.inCorso = true;
  const inviato = JSON.stringify(db);

  try {
    const risposta = await chiamaApi('stato', {
      corpo: { base: Nuvola.revisione, forza, db }
    });

    /* Il database è cambiato da un altro dispositivo: vince lui,
       senza domande. La modifica fatta qui non è arrivata e lo si dice. */
    if (risposta.conflitto) {
      adottaArchivio(risposta.db || {}, risposta.revisione);
      toast('Il database era cambiato da un altro dispositivo: ho ripreso i suoi dati. Controlla l\'ultima modifica.', 'warn', 7000);
      return false;
    }

    Nuvola.revisione = Number(risposta.revisione) || 0;
    Nuvola.ultimo = new Date().toISOString();
    Nuvola.daInviare = false;
    Nuvola.stato = 'ok';
    Nuvola.messaggio = 'Salvato nel database.';
    conflittoAperto = null;
    ultimoDalDatabase = inviato;
    scriviSegnalibro();
    /* Il database ha dato un numero nuovo a righe con un id di prima
       (es. "cli_…"): si rileggono i dati, così l'app usa quei numeri. */
    if (risposta.rinumerati) {
      Nuvola.caricato = false;
      setTimeout(allineaAllAvvio, 0);
    }
    return true;
  } catch (err) {
    /* Non salvato: lo si dice e basta. Niente nuovi tentativi da
       soli: la modifica si scarta e a schermo tornano i dati com'erano
       nel database, così non si vede niente che non sia salvato. */
    console.warn('Salvataggio nel database non riuscito:', err.message);
    Nuvola.messaggio = 'I dati non sono stati salvati.';
    Nuvola.daInviare = false;
    Nuvola.rimandato = false;
    clearTimeout(Nuvola.timer);
    tornaAlDatabase();
    toast(erroreDiRete(err)
      ? 'Nessuna connessione: i dati non sono stati salvati.'
      : 'Errore del database: i dati non sono stati salvati.', 'error', 6000);
    return false;
  } finally {
    Nuvola.inCorso = false;
    disegnaStatoNuvola();
    if (Nuvola.rimandato) { Nuvola.rimandato = false; programmaInvio(); }
  }
}

/* L'ultimo stato confermato dal database, tenuto solo in memoria (mai
   sul telefono): serve a togliere dallo schermo una modifica che il
   database non ha ricevuto. */
let ultimoDalDatabase = null;

function tornaAlDatabase() {
  if (!ultimoDalDatabase) return;
  const pin = db.settings.pinHash;
  db = hydrate(JSON.parse(ultimoDalDatabase));
  db.settings.pinHash = pin;
  renderSelectOptions();
  renderAll();
}

/** Vero quando la richiesta non è arrivata al server: niente rete o nessuna risposta in tempo. */
function erroreDiRete(err) {
  return !navigator.onLine || (err && (err.name === 'AbortError' || err.name === 'TypeError'));
}

/* ------------------------------------------------------------
   Ricezione: dal server all'app.
   ------------------------------------------------------------ */

/**
 * Prima di sostituire l'archivio di questo dispositivo se ne tiene una
 * copia accanto, nel localStorage: una scelta sbagliata nella domanda
 * "Quale copia tengo?" o un ripristino dal file sbagliato si possono
 * ancora rimediare. Si tiene solo l'ultima, che lo spazio è poco.
 */
const CHIAVE_COPIA = CONFIG.storageKey + '.copia-sostituita';

/* Niente copie sul telefono: la copia di sicurezza la tiene il
   database stesso (copia_prima_di_forzare in api/index.php). */
function mettiDaParte() {}

/** Vero se l'archivio contiene del lavoro: clienti, appuntamenti, spese o guadagni. */
function haDati(d) {
  return !!d && !!((d.appointments || []).length || (d.clients || []).length ||
                   (d.expenses || []).length || (d.incomes || []).length);
}

/** Sostituisce l'archivio con quello del server e ridisegna tutto. */
function adottaArchivio(remoto, revisione) {
  const pinLocale = db.settings.pinHash;
  const prima = db.settings;

  mettiDaParte();
  db = hydrate(remoto);
  /* Un server che gli orari non li conosce ancora non deve riportarli
     a quelli di partenza; e un PIN cambiato resta cambiato. */
  const rs = (remoto && remoto.settings) || {};
  if (!rs.orariLavoro) db.settings.orariLavoro = normOrari(prima.orariLavoro);
  if (!rs.negozi) db.settings.negozi = normNegozi(prima.negozi, db.expenses);
  if (!rs.categorieSpese) db.settings.categorieSpese = normNomi(prima.categorieSpese, DEFAULT_CATEGORIE_SPESE);
  if (!rs.categorieEntrate) db.settings.categorieEntrate = normNomi(prima.categorieEntrate, DEFAULT_CATEGORIE_ENTRATE);
  if (!rs.metodiPagamento) db.settings.metodiPagamento = normNomi(prima.metodiPagamento, DEFAULT_METODI_PAGAMENTO);
  db.settings.pinCambiato = !!(rs.pinCambiato || prima.pinCambiato || db.settings.pinCambiato);
  /* Il server il PIN non lo rimanda (lo custodisce solo in forma
     cifrata): resta quello con cui questo dispositivo è già stato
     sbloccato. Cambiarlo in "1234" chiuderebbe fuori chi sta usando
     l'app. Un PIN cambiato altrove arriva quando lo si digita: vedi
     tryUnlock(). */
  if (!(remoto.settings && remoto.settings.pinHash)) db.settings.pinHash = pinLocale;

  salvaPin();
  ultimoDalDatabase = JSON.stringify(db);

  Nuvola.revisione = Number(revisione) || 0;
  Nuvola.ultimo = new Date().toISOString();
  Nuvola.daInviare = false;
  Nuvola.caricato = true;
  Nuvola.stato = 'ok';
  Nuvola.messaggio = 'Dati del database.';
  conflittoAperto = null;
  scriviSegnalibro();

  renderSelectOptions();
  renderAll();
  disegnaStatoNuvola();
}

/**
 * Il primo contatto, appena l'app si apre. Nessuno dei casi qui
 * sotto butta via niente da solo: quando le due copie contengono
 * tutte e due del lavoro, la scelta la fa chi sta usando l'app.
 */
/* Una lettura dal database alla volta: avvio, PIN, ritorno sull'app e
   controllo periodico possono chiederla insieme. */
let allineamentoInCorso = null;
function allineaAllAvvio() {
  if (!allineamentoInCorso) {
    allineamentoInCorso = allineaOra().finally(() => { allineamentoInCorso = null; });
  }
  return allineamentoInCorso;
}

async function allineaOra() {
  if (!CONFIG.api) { disegnaStatoNuvola(); return; }

  let risposta;
  try {
    risposta = await chiamaApi('stato', { attesa: 6000 });
  } catch (err) {
    Nuvola.stato = 'offline';
    Nuvola.messaggio = spiegaGuasto(err, 'dati non caricati');
    console.warn('Database non raggiungibile:', err.message);
    disegnaStatoNuvola();
    return;
  }

  const suServer = Number(risposta.revisione) || 0;
  const locale = Nuvola.revisione;
  const hoRoba = haDati(db);

  /* Quello che c'è di là. Il server lo manda ogni volta che ci sono
     righe, anche quando il suo contatore è ancora a zero. */
  const remoto = risposta.db || null;
  const laRoba = haDati(remoto);

  /* REGOLA: I DATI STANNO SOLO NEL DATABASE.
     Il telefono non ne salva nessuna copia: quello che l'app mostra
     è solo in memoria, letto dal database a ogni apertura. Non si
     chiede mai "Quale copia tengo?": quando telefono e database non
     coincidono, vince il database. Dal telefono partono solo le
     modifiche appena fatte, a partire dalla stessa versione che ha
     il database (punto 2). */

  /* Database vuoto e allo stesso punto: quello che c'è in memoria è
     tutto, quindi le modifiche fatte qui possono partire (punto 2). */
  if (!laRoba && suServer === locale) {
    Nuvola.caricato = true;
    if (!ultimoDalDatabase) ultimoDalDatabase = JSON.stringify(Object.assign(hydrate({}), { settings: db.settings }));
  }

  /* 1. Database vuoto e niente in memoria: niente da fare. */
  if (!laRoba && !hoRoba) {
    Nuvola.revisione = suServer;
    Nuvola.stato = 'ok';
    Nuvola.messaggio = 'Database collegato, ancora vuoto.';
    disegnaStatoNuvola();
    return;
  }

  /* 2. Modifiche appena fatte qui, sulla stessa versione del
        database: si mandano. */
  if (Nuvola.daInviare && suServer === locale && Nuvola.caricato) {
    await inviaArchivio();
    return;
  }

  /* 3. Stesso numero e niente da mandare: già allineati. */
  if (!Nuvola.daInviare && suServer === locale && Nuvola.caricato) {
    Nuvola.stato = 'ok';
    Nuvola.messaggio = 'Dati del database.';
    Nuvola.ultimo = new Date().toISOString();
    if (!ultimoDalDatabase) ultimoDalDatabase = JSON.stringify(db);
    disegnaStatoNuvola();
    return;
  }

  /* 4. Tutti gli altri casi: si prendono i dati del database. Se qui
        c'erano modifiche non arrivate (il database nel frattempo è
        cambiato da un altro dispositivo), si dice che vanno rifatte. */
  const perse = Nuvola.daInviare;
  adottaArchivio(remoto || {}, suServer);
  if (perse) {
    toast('Il database era cambiato da un altro dispositivo: ho ripreso i suoi dati. Controlla l\'ultima modifica.', 'warn', 7000);
  }
}

/**
 * Le due copie sono diverse e tutte e due contengono lavoro
 * vero. Nessuna scelta automatica sarebbe onesta, quindi si
 * chiede — dicendo cosa c'è di qua e cosa di là — e prima di
 * sovrascrivere si tiene comunque una copia da parte.
 *
 * Prima passava da ask(), e lì "Annulla", la X e il tocco sullo
 * sfondo rispondevano "no", che qui voleva dire "sovrascrivo la
 * copia online": chi chiudeva per non decidere cancellava il
 * lavoro dell'altro dispositivo. Adesso ha un pannello suo, con
 * due pulsanti che dicono cosa fanno, e chiuderlo lascia tutto
 * com'è: la domanda torna alla prossima sincronizzazione.
 */
let conflittoAperto = null;   // la risposta del server su cui si deve decidere

/* La domanda non si fa più: i dati sono solo quelli del database, e
   davanti a due versioni diverse vince lui. Il pannello "Quale copia
   tengo?" resta nell'HTML ma non si apre. */
function risolviConflitto(risposta) {
  conflittoAperto = null;
  adottaArchivio((risposta && risposta.db) || {}, risposta && risposta.revisione);
}

function mostraConflitto() {
  if (!conflittoAperto) return;
  const remoto = conflittoAperto.db || {};
  /* "1 clienti" in una domanda che decide se cancellare un anno
     di agenda suona come un errore, e chi legge si fida meno di
     quello che sta leggendo proprio quando deve fidarsi di più. */
  const conta = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
  const quanti = d => [
    conta((d.appointments || []).length, 'appuntamento', 'appuntamenti'),
    conta((d.clients || []).length, 'cliente', 'clienti'),
    conta((d.expenses || []).length, 'spesa', 'spese'),
    conta((d.incomes || []).length, 'altro guadagno', 'altri guadagni')
  ].join(', ');

  $('#syncAskLocal').textContent = quanti(db);
  $('#syncAskRemote').textContent = quanti(remoto);
  if ($('#sheetSync').hidden) openSheet('sheetSync');
}

$('#syncKeepLocal').addEventListener('click', async () => {
  conflittoAperto = null;
  closeSheet('sheetSync');
  /* Vincono i dati locali: si spingono sul server, che prima di
     sovrascrivere mette da parte la sua versione (vedi api/index.php). */
  const fatto = await inviaArchivio(true);
  if (fatto) toast('Database aggiornato con i dati di questo telefono.', 'ok', 4500);
  else toast('Non sono riuscita a mandare i dati al database: riprovo da sola appena c\'è rete.', 'error', 6000);
});

$('#syncKeepRemote').addEventListener('click', () => {
  const risposta = conflittoAperto;
  conflittoAperto = null;
  closeSheet('sheetSync');
  if (!risposta) return;
  adottaArchivio(risposta.db || {}, risposta.revisione);
  toast('Ripresi i dati dal database.', 'ok', 4500);
});

/* ------------------------------------------------------------
   Lo stato della sincronizzazione non si mostra: col database
   l'app parla da sola. Si fa vedere solo quando c'è una scelta
   da fare — le due copie hanno dati diversi — con un avviso in
   Home che apre la domanda.
   ------------------------------------------------------------ */

/* L'avviso in Home compare solo quando i dati del database non ci
   sono: ancora in arrivo, o non caricati per mancanza di rete.
   Toccandolo si riprova a leggerli. Un salvataggio non riuscito non
   passa da qui: ha solo il suo avviso (vedi inviaArchivio). */
function disegnaStatoNuvola() {
  const pill = $('#homeSync');
  if (!pill) return;
  let testo = '';
  let errore = false;
  if (CONFIG.api) {
    if (Nuvola.stato === 'offline') {
      errore = true;
      testo = 'Nessuna connessione: dati non caricati, tocca per riprovare';
    } else if (!Nuvola.caricato) {
      testo = 'Carico i dati dal database…';
    }
  }
  pill.hidden = !testo;
  pill.textContent = testo;
  pill.classList.toggle('is-error', errore);
}

$('#homeSync').addEventListener('click', () => {
  if (Nuvola.inCorso) return;
  Nuvola.stato = 'ignoto';
  disegnaStatoNuvola();
  if (Nuvola.daInviare) inviaArchivio();
  else allineaAllAvvio();
});

/* ============================================================
   04. ANAGRAFICA CLIENTI
   ============================================================ */

function findClientByPhone(tel) {
  const key = phoneKey(tel);
  if (!key) return null;
  return db.clients.find(c => phoneKey(c.telefono) === key) || null;
}

/**
 * La cliente che si chiama esattamente così (nome e cognome in qualunque
 * ordine, maiuscole e accenti a parte), se è una sola. Con due omonime
 * non si sceglie a caso: si crea una scheda nuova e il suggerimento nel
 * form lascia scegliere quella giusta.
 *
 * Con un numero scritto, una scheda che ha un numero diverso è un'altra
 * persona e non vale; una scheda ancora senza numero sì.
 */
function findClientByName(nome, cognome, telefono = '') {
  const cercato = normNome(`${nome || ''} ${cognome || ''}`).split(' ').filter(Boolean).sort().join(' ');
  if (!cercato) return null;
  const tel = phoneKey(telefono);
  const trovate = db.clients.filter(c => {
    if (normNome(clientFullName(c)).split(' ').sort().join(' ') !== cercato) return false;
    return !tel || !phoneKey(c.telefono) || phoneKey(c.telefono) === tel;
  });
  return trovate.length === 1 ? trovate[0] : null;
}

/** Prima dal numero, che è univoco; senza numero, o se non c'è, dal nome. */
function findClient({ nome, cognome, telefono }) {
  return findClientByPhone(telefono) || findClientByName(nome, cognome, telefono);
}

/**
 * SINCRONIZZAZIONE ANAGRAFICA
 * Crea o aggiorna la scheda cliente. Ogni appuntamento salvato passa da
 * qui: l'anagrafica si popola da sola riconoscendo il numero di telefono
 * o, quando il numero non c'è, il nome e cognome — senza doppioni.
 * `clientId` arriva quando la cliente è già stata scelta dall'elenco.
 */
function upsertClient({ clientId, nome, cognome, telefono, indirizzo, note }) {
  const scelta = clientId ? db.clients.find(c => c.id === clientId) : null;
  const existing = scelta || findClient({ nome, cognome, telefono });

  if (existing) {
    /* Solo i campi arrivati davvero: il form appuntamento chiede nome,
       cognome e telefono, e non deve cancellare l'indirizzo già in
       scheda solo perché non lo ha chiesto. */
    if (nome) existing.nome = capitalize(nome);
    if (cognome) existing.cognome = capitalize(cognome);
    /* `indirizzo` arriva come oggetto coi suoi campi, e solo dal
       modulo cliente: il form appuntamento non lo chiede. */
    if (indirizzo !== undefined) {
      CAMPI_INDIRIZZO.forEach(k => { existing[k] = String((indirizzo || {})[k] || '').trim(); });
      existing.indirizzo = componiIndirizzo(existing);
    }
    /* Un numero vuoto non cancella quello in scheda: riconosciuta per
       nome, la cliente si tiene il numero che aveva. */
    if (normPhone(telefono)) existing.telefono = String(telefono).trim();
    /* Le note arrivano solo dal modulo cliente, quando il numero era
       già in anagrafica: si aggiungono alla scheda senza sovrascriverla. */
    if (note && !String(existing.note || '').includes(note)) {
      existing.note = existing.note ? `${existing.note} · ${note}` : note;
    }
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const client = {
    id: nuovoId(db.clients),
    nome: capitalize(nome),
    cognome: capitalize(cognome),
    telefono: String(telefono || '').trim(),
    ...Object.fromEntries(CAMPI_INDIRIZZO.map(k => [k, String((indirizzo || {})[k] || '').trim()])),
    note: note || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  client.indirizzo = componiIndirizzo(client);
  db.clients.push(client);
  return client;
}

/**
 * Storico ricalcolato dagli appuntamenti invece di tenere contatori
 * paralleli, che col tempo divergerebbero dai dati reali.
 * `spesa` è quanto la cliente ha davvero pagato: solo i completati.
 */
function clientStats(clientId) {
  const list = db.appointments.filter(a => a.clientId === clientId);
  const done = list.filter(a => a.stato === 'done');
  const spesa = sum(done, 'prezzo');
  return {
    trattamenti: done.length,
    spesa,
    prenotati: list.length - done.length,
    ultima: done.map(a => a.data).sort().pop() || null,
    media: done.length ? spesa / done.length : 0
  };
}

function clientFullName(client) {
  return [client.nome, client.cognome].filter(Boolean).join(' ').trim() || 'Senza nome';
}

function clientLabel(appt) {
  return [appt.nome, appt.cognome].filter(Boolean).join(' ') || 'Senza nome';
}

/**
 * Cancellazione su richiesta della cliente (GDPR). La scheda sparisce;
 * gli appuntamenti già registrati restano nei conti ma senza scheda
 * collegata, perché gli incassi dell'anno non devono cambiare.
 */
async function deleteClient(id) {
  const c = db.clients.find(x => x.id === id);
  if (!c) return;
  const linked = db.appointments.filter(a => a.clientId === id).length;
  const extra = linked
    ? ` I suoi ${linked} appuntamenti resteranno in agenda senza scheda collegata.`
    : '';
  const ok = await ask('Eliminare la scheda?', clientFullName(c) + '.' + extra);
  if (!ok) return;
  db.clients = db.clients.filter(x => x.id !== id);
  saveDB();
  closeSheet('sheetClientView');
  renderAll();
  toast('Scheda eliminata.', 'warn');
}

/** Tutti gli appuntamenti di una cliente, dal più recente. */
function clientHistory(clientId) {
  return db.appointments
    .filter(a => a.clientId === clientId)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || toMinutes(b.ora) - toMinutes(a.ora));
}

/* ============================================================
   05. APPUNTAMENTI
   ============================================================ */

function getService(id) {
  return db.services.find(s => s.id === id) ||
         db.services[db.services.length - 1] ||
         DEFAULT_SERVICES[0];
}

function apptsByDay(dateKey) {
  return db.appointments
    .filter(a => a.data === dateKey)
    .sort((a, b) => toMinutes(a.ora) - toMinutes(b.ora));
}

/**
 * CONTROLLO SOVRAPPOSIZIONI
 * Conflitto quando, nello stesso giorno, gli intervalli [inizio, fine)
 * si intersecano. `ignoreId` esclude l'appuntamento in modifica, che
 * altrimenti si sovrapporrebbe a sé stesso.
 */
function findConflicts(candidate, ignoreId = null) {
  const start = toMinutes(candidate.ora);
  const end = start + Number(candidate.durata || 0);

  return db.appointments
    .filter(a => {
      if (a.id === ignoreId) return false;
      if (a.data !== candidate.data) return false;
      const aStart = toMinutes(a.ora);
      const aEnd = aStart + Number(a.durata || 0);
      return start < aEnd && aStart < end;
    })
    .sort((a, b) => toMinutes(a.ora) - toMinutes(b.ora));
}

/* ------------------------------------------------------------
   ORARI LIBERI
   Dagli orari di lavoro del giorno si tolgono gli appuntamenti già
   presi: restano le fasce libere. Dentro ogni fascia si propongono
   solo gli inizi in cui il trattamento ci sta per intero e che non
   lasciano, prima o dopo, un ritaglio più corto di mezz'ora — un
   pezzetto così non lo prenoterebbe più nessuno. Il ritocco veloce
   è l'eccezione: lì valgono anche i buchi stretti.
   ------------------------------------------------------------ */

/**
 * Le fasce di lavoro accese quel giorno, in minuti [inizio, fine), in
 * ordine. Due fasce attaccate (pomeriggio fino alle 18, sera dalle 18)
 * diventano una sola: un trattamento può stare a cavallo fra le due.
 * Vuoto se è giorno di chiusura.
 */
function turniDelGiorno(dateKey) {
  const o = (db.settings.orariLavoro || {})[fromKey(dateKey).getDay()] || {};
  const turni = FASCE
    .map(f => o[f.id])
    .filter(x => x && x.attivo && toMinutes(x.a) > toMinutes(x.da))
    .map(x => [toMinutes(x.da), toMinutes(x.a)])
    .sort((p, q) => p[0] - q[0]);
  const uniti = [];
  turni.forEach(([s, e]) => {
    const ultimo = uniti[uniti.length - 1];
    if (ultimo && s <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], e);
    else uniti.push([s, e]);
  });
  return uniti;
}

/** Fasce libere [inizio, fine) del giorno, in minuti. */
function fasceLibere(dateKey, ignoreId = null) {
  /* Oggi non si propone un orario già passato: si parte dal prossimo
     quarto d'ora. */
  let adesso = 0;
  if (dateKey === toKey(new Date())) {
    const ora = new Date();
    adesso = Math.ceil((ora.getHours() * 60 + ora.getMinutes() + 1) / 15) * 15;
  }

  const occupati = apptsByDay(dateKey)
    .filter(a => a.id !== ignoreId)
    .map(a => [toMinutes(a.ora), toMinutes(a.ora) + (Number(a.durata) || 0)]);

  const fasce = [];
  turniDelGiorno(dateKey).forEach(([ts, te]) => {
    let cursore = Math.max(ts, adesso);
    occupati.forEach(([s, e]) => {
      if (e <= cursore || s >= te) return;
      if (s > cursore) fasce.push([cursore, s]);
      cursore = Math.max(cursore, e);
    });
    if (cursore < te) fasce.push([cursore, te]);
  });
  return fasce.filter(([s, e]) => e > s);
}

/**
 * Gli orari d'inizio prenotabili, in minuti.
 * @param {boolean} eccezione  ritocco veloce: niente regola dei ritagli.
 */
function slotLiberi(dateKey, durata, { ignoreId = null, eccezione = false } = {}) {
  const dur = Number(durata) || 0;
  if (!dur) return [];
  const ritaglioMin = eccezione ? 0 : DURATA_MINIMA;
  const ok = n => n === 0 || n >= ritaglioMin;
  const out = new Set();

  fasceLibere(dateKey, ignoreId).forEach(([s, e]) => {
    if (e - s < dur) return;                      // buco troppo stretto
    const candidati = [s, e - dur];
    for (let t = Math.ceil(s / PASSO_SLOT) * PASSO_SLOT; t <= e - dur; t += PASSO_SLOT) candidati.push(t);
    candidati.forEach(t => {
      if (t >= s && t + dur <= e && ok(t - s) && ok(e - (t + dur))) out.add(t);
    });
  });
  return [...out].sort((a, b) => a - b);
}

/** Il primo orario libero del giorno, per precompilare il form. */
function primoSlotLibero(dateKey, durata, opzioni) {
  const s = slotLiberi(dateKey, durata, opzioni);
  return s.length ? toHHMM(s[0]) : '';
}

function commitAppointment(payload) {
  /* Le note dell'appuntamento restano sull'appuntamento. Prima
     finivano anche nella scheda, per sempre: "arriva dieci minuti
     tardi" diventava una nota fissa della cliente, e a ogni modifica
     se ne aggiungeva un pezzo. */
  const client = upsertClient({
    clientId: payload.clientId,
    nome: payload.nome,
    cognome: payload.cognome,
    telefono: payload.telefono
  });

  const service = getService(payload.serviceId);
  const aggiuntivi = [...new Set((payload.aggiuntivi || []).map(String))]
    .filter(id => id !== service.id && db.services.some(s => s.id === id));
  const record = {
    id: payload.id || nuovoId(db.appointments),
    clientId: client.id,
    nome: client.nome,
    cognome: client.cognome,
    telefono: client.telefono,
    serviceId: service.id,
    aggiuntivi,
    servizio: nomeServizi(service, aggiuntivi),
    data: payload.data,
    ora: payload.ora,
    durata: Number(payload.durata) || service.durata,
    prezzo: Number(payload.prezzo) || 0,
    stato: payload.stato in STATI ? payload.stato : 'wait',
    note: payload.note || '',
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const idx = db.appointments.findIndex(a => a.id === record.id);
  const servizioPrima = idx >= 0 ? db.appointments[idx].servizio : '';
  if (idx >= 0) db.appointments[idx] = record;
  else db.appointments.push(record);

  /* Il numero aggiunto da qui finisce nella scheda: gli altri
     appuntamenti della stessa cliente lo prendono anche loro. */
  allineaAppuntamenti(db);
  /* Un appuntamento già completato porta con sé il suo guadagno:
     data, importo e cliente lo seguono. */
  allineaGuadagno(record, servizioPrima);
  saveDB();
  return record;
}

/* --- Guadagno collegato all'appuntamento -------------------
   Quando un appuntamento si segna completato nasce un guadagno vero,
   con `appuntamentoId`. Nei Conti si modifica come gli altri guadagni.
   Regola: guadagno e appuntamento hanno sempre la stessa data e lo
   stesso importo (= prezzo). Per questo i totali contano i trattamenti
   dagli appuntamenti e, dei guadagni, solo quelli a mano: mai due volte
   gli stessi soldi (vedi guadagnoAMano). */

/** Il guadagno nato da un appuntamento, se c'è. */
function guadagnoDi(apptId) {
  return db.incomes.find(i => i.appuntamentoId && i.appuntamentoId === apptId) || null;
}

/** Vero per i guadagni da sommare a parte: quelli a mano, o rimasti senza il loro appuntamento. */
function guadagnoAMano(i) {
  return !i.appuntamentoId || !db.appointments.some(a => a.id === i.appuntamentoId && a.stato === 'done');
}

/** Il tipo del guadagno di un trattamento, fra le categorie che ci sono. */
function categoriaTrattamento(appt) {
  const lista = db.settings.categorieEntrate || [];
  const voluto = (appt.aggiuntivi || []).length ? 'Trattamento mani e piedi'
    : /piedi|pedicure/i.test(appt.serviceId || '') ? 'Trattamento piedi' : 'Trattamento mani';
  return lista.find(n => n.toLowerCase() === voluto.toLowerCase()) || lista[0] || 'Altro';
}

function creaGuadagno(appt, metodo) {
  const adesso = new Date().toISOString();
  const nuovo = {
    id: nuovoId(db.incomes),
    data: appt.data,
    importo: Number(appt.prezzo) || 0,
    categoria: categoriaTrattamento(appt),
    descrizione: appt.servizio || '',
    cliente: clientLabel(appt),
    metodo: metodo || '',
    appuntamentoId: appt.id,
    createdAt: adesso,
    updatedAt: adesso
  };
  db.incomes.push(nuovo);
  return nuovo;
}

/** Dopo la modifica di un appuntamento completato: il guadagno lo segue. */
function allineaGuadagno(appt, servizioPrima = '') {
  if (appt.stato !== 'done') return;
  const g = guadagnoDi(appt.id);
  if (!g) { creaGuadagno(appt, ''); return; }
  g.data = appt.data;
  g.importo = Number(appt.prezzo) || 0;
  g.cliente = clientLabel(appt);
  /* La descrizione segue il servizio, se non è stata scritta a mano. */
  if (!g.descrizione || g.descrizione === servizioPrima) g.descrizione = appt.servizio || '';
  g.updatedAt = new Date().toISOString();
}

/**
 * Segna un appuntamento completato o da completare. Completandolo si
 * chiede come ha pagato: con la risposta nasce il guadagno nei Conti;
 * chiudendo la domanda non si salva niente e resta com'era.
 * Rimettendolo da completare, il suo guadagno sparisce.
 */
async function setStato(id, stato, silent = false) {
  const appt = db.appointments.find(a => a.id === id);
  if (!appt || !(stato in STATI)) return;

  let metodo = '';
  if (stato === 'done' && appt.stato !== 'done') {
    metodo = await chiediPagamento(appt);
    if (metodo === null) {
      /* Niente risposta: la spunta torna com'era. */
      if (state.viewApptId === id) fillApptView(id);
      renderAll();
      return;
    }
  }

  appt.stato = stato;
  appt.updatedAt = new Date().toISOString();
  if (stato === 'done') {
    const g = guadagnoDi(id);
    if (g) { g.metodo = metodo || g.metodo; allineaGuadagno(appt); }
    else creaGuadagno(appt, metodo);
  } else {
    db.incomes = db.incomes.filter(i => i.appuntamentoId !== id);
  }
  saveDB();
  renderAll();
  if (state.viewApptId === id) fillApptView(id);
  if (!silent) toast(stato === 'done'
    ? `Appuntamento di ${appt.nome} completato, ${fmtEuro(appt.prezzo)} nei Conti${metodo ? ` (${metodo})` : ''}.`
    : `Appuntamento di ${appt.nome} di nuovo da completare.`, stato === 'done' ? 'ok' : 'info');
}

/* --- "Come ha pagato?" ------------------------------------ */
let pagamentoResolve = null;

/** Chiede il metodo di pagamento. Risponde col nome, o null se si chiude. */
function chiediPagamento(appt) {
  return new Promise(resolve => {
    pagamentoResolve = resolve;
    $('#payText').textContent = `${clientLabel(appt)} — ${fmtEuro(appt.prezzo)}`;
    riempiMetodi($('#payMetodo'), db.settings.metodiPagamento[0] || '', false);
    openSheet('sheetPagamento');
  });
}

function pagamentoClose(risposta) {
  const resolve = pagamentoResolve;
  pagamentoResolve = null;
  closeSheet('sheetPagamento');
  if (resolve) resolve(risposta);
}

/**
 * Riempie un menu dei metodi di pagamento. `conVuoto` aggiunge
 * "Non indicato" (guadagni di prima, nati senza la domanda).
 */
function riempiMetodi(sel, scelto, conVuoto = true) {
  if (!sel) return;
  const lista = [...(db.settings.metodiPagamento || [])];
  if (scelto && !lista.some(n => n.toLowerCase() === scelto.toLowerCase())) lista.push(scelto);
  sel.innerHTML = (conVuoto ? '<option value="">Non indicato</option>' : '') +
    lista.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  sel.value = lista.find(n => n.toLowerCase() === String(scelto || '').toLowerCase()) || (conVuoto ? '' : lista[0] || '');
}

async function deleteAppointment(id) {
  const appt = db.appointments.find(a => a.id === id);
  if (!appt) return;
  const when = `${fmtDayShort.format(fromKey(appt.data))} alle ${appt.ora}`;
  const conGuadagno = !!guadagnoDi(id);
  const ok = await ask("Eliminare l'appuntamento?",
    `${clientLabel(appt)} — ${appt.servizio}, ${when}.` +
    (conGuadagno ? ' Sparisce anche il suo guadagno dai Conti.' : ''));
  if (!ok) return;
  db.appointments = db.appointments.filter(a => a.id !== id);
  db.incomes = db.incomes.filter(i => i.appuntamentoId !== id);
  saveDB();
  closeSheet('sheetApptView');
  renderAll();
  toast('Appuntamento eliminato.', 'warn');
}

/* ============================================================
   06. SPESE
   ============================================================ */

function commitExpense(payload) {
  const record = {
    id: payload.id || nuovoId(db.expenses),
    data: payload.data,
    importo: Number(payload.importo) || 0,
    categoria: String(payload.categoria || '').trim() || db.settings.categorieSpese[0] || 'Altro',
    descrizione: payload.descrizione,
    fornitore: payload.fornitore || '',
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const idx = db.expenses.findIndex(e => e.id === record.id);
  if (idx >= 0) db.expenses[idx] = record;
  else db.expenses.push(record);

  saveDB();
  return record;
}

async function deleteExpense(id) {
  const exp = db.expenses.find(e => e.id === id);
  if (!exp) return;
  const ok = await ask('Eliminare la spesa?',
    `${exp.descrizione} — ${fmtEuro(exp.importo)} del ${fmtDayShort.format(fromKey(exp.data))}.`);
  if (!ok) return;
  db.expenses = db.expenses.filter(e => e.id !== id);
  saveDB();
  closeSheet('sheetExpenseView');
  closeSheet('sheetExpense');
  renderAll();
  toast('Spesa eliminata.', 'warn');
}

/* --- Guadagni aggiunti a mano ----------------------------
   Tutto quello che entra senza passare dall'agenda: un prodotto
   venduto, un buono regalo, una mancia. Stessa forma delle spese. */
function commitIncome(payload) {
  const prima = payload.id ? db.incomes.find(i => i.id === payload.id) : null;
  const appuntamentoId = prima ? prima.appuntamentoId || '' : '';
  const appt = appuntamentoId ? db.appointments.find(a => a.id === appuntamentoId) : null;

  const record = {
    id: payload.id || nuovoId(db.incomes),
    /* Collegato a un appuntamento: la data resta quella dell'appuntamento. */
    data: appt ? appt.data : payload.data,
    importo: Number(payload.importo) || 0,
    categoria: String(payload.categoria || '').trim() || db.settings.categorieEntrate[0] || 'Altro',
    descrizione: payload.descrizione || '',
    cliente: payload.cliente || '',
    metodo: String(payload.metodo || ''),
    appuntamentoId,
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const idx = db.incomes.findIndex(i => i.id === record.id);
  if (idx >= 0) db.incomes[idx] = record;
  else db.incomes.push(record);

  /* Importo e prezzo sono lo stesso numero: cambia anche l'appuntamento. */
  if (appt && Number(appt.prezzo) !== record.importo) {
    appt.prezzo = record.importo;
    appt.updatedAt = record.updatedAt;
  }

  saveDB();
  return record;
}

/** Il nome di un guadagno: la descrizione se c'è, se no il tipo. */
function incomeTitle(i) {
  return i.descrizione || i.categoria || 'Guadagno';
}

/**
 * Eliminare un guadagno. Se è collegato a un appuntamento si chiede
 * conferma dicendo cosa succede: con "sì" il guadagno sparisce e
 * l'appuntamento torna da completare; con "no" resta tutto com'era.
 */
async function deleteIncome(id) {
  const inc = db.incomes.find(i => i.id === id);
  if (!inc) return;
  const appt = inc.appuntamentoId ? db.appointments.find(a => a.id === inc.appuntamentoId) : null;

  if (appt) {
    const ok = await ask('Sei sicura?',
      `Questo guadagno è collegato all'appuntamento di ${clientLabel(appt)} del ` +
      `${fmtDayShort.format(fromKey(appt.data))}. Se lo elimini, l'appuntamento torna da completare.`,
      'Sì, elimina');
    if (!ok) return;
    db.incomes = db.incomes.filter(i => i.id !== id);
    appt.stato = 'wait';
    appt.updatedAt = new Date().toISOString();
    saveDB();
    closeSheet('sheetIncomeView');
    closeSheet('sheetIncome');
    renderAll();
    toast(`Guadagno eliminato: l'appuntamento di ${appt.nome} è di nuovo da completare.`, 'warn', 5000);
    return;
  }

  const ok = await ask('Eliminare il guadagno?',
    `${incomeTitle(inc)} — ${fmtEuro(inc.importo)} del ${fmtDayShort.format(fromKey(inc.data))}.`);
  if (!ok) return;
  db.incomes = db.incomes.filter(i => i.id !== id);
  saveDB();
  closeSheet('sheetIncomeView');
  closeSheet('sheetIncome');
  renderAll();
  toast('Guadagno eliminato.', 'warn');
}

/* ============================================================
   07. BILANCIO
   ============================================================ */

/**
 * Guadagni = trattamenti completati (le prenotazioni non sono soldi)
 * più quelli aggiunti a mano. `trattamenti` e `daTrattamenti` restano
 * a parte: la media a trattamento si fa solo su quelli.
 */
function monthTotals(year, monthIndex) {
  const prefix = monthPrefix(year, monthIndex);
  const done = db.appointments.filter(a => a.stato === 'done' && String(a.data).startsWith(prefix));
  /* I guadagni dei trattamenti sono già nei `done`: qui solo quelli a mano. */
  const extra = db.incomes.filter(i => guadagnoAMano(i) && String(i.data).startsWith(prefix));
  const spese = db.expenses.filter(e => String(e.data).startsWith(prefix));
  const daTrattamenti = sum(done, 'prezzo');
  const incassi = daTrattamenti + sum(extra, 'importo');
  const uscite = sum(spese, 'importo');
  return {
    incassi, uscite, netto: incassi - uscite,
    trattamenti: done.length, daTrattamenti,
    altre: extra.length, voci: spese.length
  };
}

function yearRows(year) {
  return Array.from({ length: 12 }, (_, m) => Object.assign({ mese: m }, monthTotals(year, m)));
}

/** Anni presenti in archivio, sempre con l'anno corrente incluso. */
function knownYears() {
  const years = new Set([new Date().getFullYear()]);
  db.appointments.forEach(a => years.add(Number(String(a.data).slice(0, 4))));
  db.expenses.forEach(e => years.add(Number(String(e.data).slice(0, 4))));
  db.incomes.forEach(i => years.add(Number(String(i.data).slice(0, 4))));
  return [...years].filter(Number.isFinite).sort((a, b) => b - a);
}

/* ============================================================
   08. TELEFONO, EMAIL E MAPPE
   ============================================================ */

/**
 * Apre un indirizzo fuori dall'app (WhatsApp, telefono, mappe, email).
 * `window.open` va benissimo nel browser normale, ma dentro un iframe
 * — l'anteprima online — viene bloccato e restituisce null senza dire
 * niente: in quel caso si naviga di persona, e su iPhone è proprio la
 * navigazione che passa la mano all'app giusta.
 */
function openExternal(url) {
  let win = null;
  try { win = window.open(url, '_blank', 'noopener'); } catch (_) { win = null; }
  if (!win) window.location.href = url;
}

function chiama(tel) {
  if (!normPhone(tel)) { toast('Numero non valido.', 'error'); return; }
  openExternal('tel:+' + phoneKey(tel));
}

/**
 * MAPPA — per le visite a domicilio.
 * Il formato universale di Google Maps: su iPhone apre l'app Google
 * Maps se c'è, altrimenti Mappe o il sito, senza dover indovinare
 * quale sia installata.
 */
function apriMappa(indirizzo) {
  const q = String(indirizzo || '').trim();
  if (!q) { toast('Nessun indirizzo in scheda.', 'error'); return; }
  openExternal('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q));
}

/** Indirizzo della cliente collegata a un appuntamento, se c'è. */
function apptAddress(appt) {
  const c = db.clients.find(x => x.id === appt.clientId);
  return c ? String(c.indirizzo || '').trim() : '';
}

/* ============================================================
   08b. CALENDARIO DEL TELEFONO (.ics)
   ------------------------------------------------------------
   Esportazione manuale, mai automatica: si scarica un file .ics
   che su iPhone si apre in Calendario e chiede conferma prima di
   aggiungere. Non è una sincronizzazione — una modifica fatta qui
   dopo l'esportazione non arriva al telefono.

   Gli orari sono scritti in "ora locale fluttuante", senza fuso:
   le 14:00 restano le 14:00 su qualunque telefono, che è proprio
   il comportamento giusto per un appuntamento in studio.
   ============================================================ */

/** Virgole, punti e virgola e a capo hanno un significato nel formato. */
function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Il formato vuole righe da 75 ottetti: le successive iniziano con uno spazio. */
function icsFold(line) {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

function icsUtc(date) {
  const p = n => String(n).padStart(2, '0');
  return date.getUTCFullYear() + p(date.getUTCMonth() + 1) + p(date.getUTCDate()) +
         'T' + p(date.getUTCHours()) + p(date.getUTCMinutes()) + p(date.getUTCSeconds()) + 'Z';
}

/** Ora locale fluttuante: niente Z, niente fuso. */
function icsLocal(date) {
  const p = n => String(n).padStart(2, '0');
  return date.getFullYear() + p(date.getMonth() + 1) + p(date.getDate()) +
         'T' + p(date.getHours()) + p(date.getMinutes()) + '00';
}

function apptStart(appt) {
  const d = fromKey(appt.data);
  d.setHours(Math.floor(toMinutes(appt.ora) / 60), toMinutes(appt.ora) % 60, 0, 0);
  return d;
}

function buildIcs(list, calName) {
  const now = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gestionale//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsEscape(calName)
  ];

  list.forEach(a => {
    const start = apptStart(a);
    const end = new Date(start.getTime() + (Number(a.durata) || 60) * 60000);
    const indirizzo = apptAddress(a);

    const dettagli = [
      a.servizio,
      a.telefono ? 'Tel: ' + a.telefono : '',
      `Prezzo: ${fmtEuro(a.prezzo)}`,
      `Stato: ${(STATI[a.stato] || STATI.wait).label}`,
      a.note || ''
    ].filter(Boolean).join('\n');

    lines.push(
      'BEGIN:VEVENT',
      'UID:' + a.id + '@gestionale',
      'DTSTAMP:' + icsUtc(now),
      'DTSTART:' + icsLocal(start),
      'DTEND:' + icsLocal(end),
      'SUMMARY:' + icsEscape(`${clientLabel(a)} — ${a.servizio}`),
      'DESCRIPTION:' + icsEscape(dettagli)
    );
    if (indirizzo) lines.push('LOCATION:' + icsEscape(indirizzo));
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

function esportaIcs(list, filename, calName) {
  if (!list.length) { toast('Non c\'è niente da esportare in questo periodo.', 'warn'); return; }
  saveFile(filename, buildIcs(list, calName), 'text/calendar;charset=utf-8');
}

/** Appuntamenti compresi fra due chiavi data, in ordine. */
function apptsBetween(fromDateKey, toDateKey) {
  return db.appointments
    .filter(a => String(a.data) >= fromDateKey && String(a.data) <= toDateKey)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || toMinutes(a.ora) - toMinutes(b.ora));
}

/* ============================================================
   09. UI
   ============================================================ */

const toastsBox = $('#toasts');

/* Un avviso parla del pannello in cui è nato: aprendone o chiudendone
   uno, quelli vecchi se ne vanno invece di restare sopra ai pulsanti
   della schermata nuova. */
function clearToasts() {
  if (toastsBox) toastsBox.innerHTML = '';
}

function toast(message, type = 'info', duration = 3600) {
  if (!toastsBox) return;
  /* Uno alla volta: due avvisi impilati coprivano mezzo pannello. */
  clearToasts();
  const el = document.createElement('div');
  el.className = 'toast' + (type !== 'info' ? ` toast--${type}` : '');
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  toastsBox.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 400);
  }, duration);
}

/**
 * Il toast dice che cosa manca, ma sparisce: il bordo rosso resta sul
 * campo finché non lo si tocca, e il primo prende il fuoco, così non
 * si deve andare a cercarlo.
 */
function segnalaCampi(selettori) {
  selettori.forEach((sel, i) => {
    const el = $(sel);
    if (!el) return;
    const campo = el.closest('.field') || el;
    campo.classList.add('is-invalid');
    if (i === 0) el.focus();
  });
}
['input', 'change'].forEach(evt => document.addEventListener(evt, event => {
  const campo = event.target.closest && event.target.closest('.field.is-invalid');
  if (!campo) return;
  campo.classList.remove('is-invalid');
  /* Sistemato l'ultimo campo segnato, l'avviso che lo chiedeva non
     ha più niente da dire. */
  const sheet = campo.closest('.sheet');
  if (sheet && !$('.is-invalid', sheet)) clearToasts();
}));

/* --- Pannelli (sheet) ------------------------------------ */
let lastFocused = null;

function openSheet(id) {
  const sheet = $('#' + id);
  if (!sheet) return;
  lastFocused = document.activeElement;
  /* I campi segnalati l'ultima volta non restano rossi alla riapertura. */
  $$('.is-invalid', sheet).forEach(el => el.classList.remove('is-invalid'));
  clearToasts();
  sheet.hidden = false;
  /* Senza questo la pagina dietro continua a scorrere sotto le dita
     mentre il pannello è aperto. */
  document.body.classList.add('is-sheet');
}

function closeSheet(id) {
  const sheet = $('#' + id);
  if (!sheet) return;
  sheet.hidden = true;
  clearToasts();
  if (id === 'sheetConflict') state.pendingSave = null;
  if (id === 'sheetApptView') state.viewApptId = null;
  if (id === 'sheetClientView') state.viewClientId = null;
  if (id === 'sheetExpenseView') state.viewExpenseId = null;
  if (id === 'sheetIncomeView') state.viewIncomeId = null;
  /* Chiuso dalla X o dallo sfondo: chi aspettava la risposta la riceve
     comunque, altrimenti resterebbe appeso per sempre. */
  if (id === 'sheetAsk' && askResolve) { const r = askResolve; askResolve = null; r(false); }
  /* "Come ha pagato?" chiusa con la X o toccando fuori: non si salva niente. */
  if (id === 'sheetPagamento' && pagamentoResolve) { const r = pagamentoResolve; pagamentoResolve = null; r(null); }
  /* Lo scorrimento torna solo se non è rimasto aperto un altro pannello:
     dal form si passa all'avviso di sovrapposizione. */
  if (!$$('.sheet').some(s => !s.hidden)) document.body.classList.remove('is-sheet');
  if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
}

$$('[data-close]').forEach(el => el.addEventListener('click', () => closeSheet(el.dataset.close)));

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const open = $$('.sheet').filter(s => !s.hidden).pop();
  if (open) closeSheet(open.id);
});

/* Le voci delle Impostazioni aprono il pannello indicato in data-sheet. */
$$('[data-sheet]').forEach(btn => btn.addEventListener('click', () => {
  const id = btn.dataset.sheet;
  if (id === 'sheetListino') renderServices();
  if (id === 'sheetOrari') renderOrari();
  if (id === 'sheetNegozi') renderNegozi();
  if (id === 'sheetCatSpese') renderCatSpese();
  if (id === 'sheetCatEntrate') renderCatEntrate();
  if (id === 'sheetMetodi') renderMetodi();
  if (id === 'sheetBackup') renderReportPeriods();
  openSheet(id);
}));

/* --- Richiesta di conferma ------------------------------- */
/*
  Rimpiazza confirm(). Dentro un riquadro ospitato da un'altra pagina le
  finestrelle di sistema sono disattivate: confirm() torna "no" senza
  mostrare niente, e ogni eliminazione falliva in silenzio. Questa invece
  è parte dell'app, quindi funziona ovunque — e assomiglia al resto.
*/
let askResolve = null;

function ask(titolo, testo, etichetta = 'Elimina') {
  return new Promise(resolve => {
    askResolve = resolve;
    $('#askTitle').textContent = titolo;
    $('#askText').textContent = testo;
    $('#askYes').textContent = etichetta;
    openSheet('sheetAsk');
    /* Il pulsante che cancella non deve essere quello a fuoco per sbaglio. */
    setTimeout(() => $('#askYes').blur(), 80);
  });
}

/** Chiude e risponde. Vale anche per la X e per il tocco sullo sfondo. */
function askClose(risposta) {
  const resolve = askResolve;
  askResolve = null;
  closeSheet('sheetAsk');
  if (resolve) resolve(risposta);
}

$('#askYes').addEventListener('click', () => askClose(true));
$('#askNo').addEventListener('click', () => askClose(false));

/* --- Blocco schermo e tastierino PIN --------------------- */
const lockScreen = $('#lock');
const shell = $('#shell');
const pinInput = $('#pinInput');
const pinDots = $('#pinDots');
let idleTimer = null;

/**
 * Il saluto della schermata di blocco, secondo l'ora:
 * buongiorno dalle 00:01 alle 13:00, buon pomeriggio dalle 13:01 alle
 * 18:00, buonasera dalle 18:01 alle 23:59 (e a mezzanotte in punto,
 * che è ancora la sera prima).
 */
function salutoOrario(date = new Date()) {
  const m = date.getHours() * 60 + date.getMinutes();
  if (m >= 1 && m <= 13 * 60) return { testo: 'Buongiorno', icona: 'sole' };
  if (m > 13 * 60 && m <= 18 * 60) return { testo: 'Buon pomeriggio', icona: 'pomeriggio' };
  return { testo: 'Buonasera', icona: 'luna' };
}

const ICONE_SALUTO = {
  sole: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5"/>',
  pomeriggio: '<path d="M3 17.5h18M6.5 17.5a5.5 5.5 0 0 1 11 0"/><path d="M12 6.2v2M5.2 9.6l1.4 1.4M18.8 9.6l-1.4 1.4M7 21h10"/>',
  luna: '<path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1Z"/>'
};

function renderLockGreeting() {
  const ora = new Date();
  const s = salutoOrario(ora);
  $('#lockHello').textContent = CONFIG.nome ? `${s.testo}, ${CONFIG.nome}` : s.testo;
  $('#lockIcon').innerHTML = ICONE_SALUTO[s.icona];
  $('#lockDate').textContent = capitalize(fmtDayLong.format(ora));
}
/* Lasciata aperta sul tavolo, la schermata cambia saluto da sola. */
setInterval(() => { if (!state.unlocked) renderLockGreeting(); }, 30000);

/**
 * Un pallino per cifra digitata. Fino a quattro si vedono anche i posti
 * vuoti, così il minimo richiesto è leggibile a colpo d'occhio; oltre,
 * la fila cresce con l'inserimento.
 */
function renderPinDots() {
  const len = pinInput.value.length;
  const total = Math.max(4, len);
  pinDots.innerHTML = Array.from({ length: total },
    (_, i) => `<span class="pin-dot${i < len ? ' is-on' : ''}"></span>`).join('');
}

/* Niente pulsante "Entra": smesso di digitare, il PIN si controlla da
   solo. Serve per il PIN sbagliato (che così si sente dire) e per
   quello cambiato su un altro dispositivo, che va chiesto al server.
   Un secondo basta a cercare la cifra dopo senza che il controllo
   parta a metà di un PIN lungo; i due secondi e mezzo di prima si
   sommavano all'attesa del server e l'ingresso sembrava bloccato. */
let pinTimer = null;
const PIN_PAUSA = 1000;

function pinPush(digit) {
  if (pinInput.value.length >= 8) return;
  clearTimeout(pinTimer);
  pinInput.value += digit;
  $('#pinError').hidden = true;
  renderPinDots();
  /* Verifica silenziosa a ogni cifra da quattro in su: col PIN giusto
     l'app si apre senza dover premere anche "Entra". */
  if (pinInput.value.length >= 4 && hashPin(pinInput.value) === db.settings.pinHash) {
    tryUnlock();
    return;
  }
  /* Arrivati al massimo delle cifre non c'è più niente da aggiungere:
     meglio dire subito che non va che lasciare un tastierino muto. */
  if (pinInput.value.length >= 8) { tryUnlock(); return; }
  if (pinInput.value.length >= 4) {
    pinTimer = setTimeout(() => {
      if (!state.unlocked && pinInput.value.length >= 4) tryUnlock();
    }, PIN_PAUSA);
  }
}

function pinClear(all = false) {
  clearTimeout(pinTimer);
  pinInput.value = all ? '' : pinInput.value.slice(0, -1);
  $('#pinError').hidden = true;
  renderPinDots();
}

function pinWrong() {
  /* Il testo si riscrive ogni volta: il recupero da database può
     averlo sostituito con un avviso sulla rete, e quello non
     deve restare lì a spiegare il tentativo dopo. */
  $('#pinError').textContent = 'PIN errato. Riprova.';
  $('#pinError').hidden = false;
  /* Come sul telefono: i pallini si svuotano, tremano, e si riscrive. */
  pinInput.value = '';
  renderPinDots();
  pinDots.classList.add('is-wrong');
  setTimeout(() => pinDots.classList.remove('is-wrong'), 420);
  if (navigator.vibrate) navigator.vibrate(80);
}

function tryUnlock() {
  if (hashPin(pinInput.value) === db.settings.pinHash) {
    /* L'app si apre subito, col confronto fatto qui: la sessione col
       server si apre dietro, e senza rete semplicemente aspetta. Se
       non riesce lo dice il database, come ogni
       altro guasto della sincronizzazione. */
    if (CONFIG.api) {
      accedi(db.settings.pinHash, true)
        .catch(err => console.warn('Accesso al server rimandato:', err.message));
    }
    unlockApp();
    chiediPinNuovoSeServe();
    return true;
  }

  /* Il PIN non è quello di questo dispositivo. Prima di dire di
     no, un caso va considerato: il telefono nuovo.

     Un'installazione appena fatta ha il PIN di fabbrica e un
     archivio vuoto, quindi il PIN vero — quello di chi sta
     digitando — qui risulta sbagliato per forza. Ma è giusto: è
     quello che il database conosce. Chiederlo al server è
     l'unico modo perché "cambio telefono" voglia dire scrivere
     il proprio PIN e ritrovare tutto, invece di ripartire da
     zero.

     Si prova solo a dispositivo vergine: se qui c'è del lavoro,
     un PIN sbagliato resta un PIN sbagliato. */
  if (puoRecuperareDalDatabase()) { recuperaDalDatabase(pinInput.value); return false; }

  /* Secondo caso: il PIN è stato cambiato su un altro dispositivo.
     Qui c'è ancora quello vecchio, e il server — che il PIN non lo
     rimanda mai indietro — è l'unico a sapere se quello digitato è
     il nuovo. Si chiede solo smesso di digitare (o all'ottava
     cifra), non a ogni tasto: i tentativi sbagliati il server li conta. */
  if (CONFIG.api) { verificaPinSulServer(pinInput.value); return false; }

  pinWrong();
  return false;
}

async function verificaPinSulServer(pin) {
  if (recuperoInCorso) return;
  recuperoInCorso = true;
  $('#pinError').textContent = 'Controllo il PIN sul server…';
  $('#pinError').hidden = false;
  const atteso = hashPin(pin);
  try {
    const dati = await accedi(atteso, true);
    /* PIN di servizio (sviluppatrice): apre l'app senza toccare il PIN
       di questo dispositivo, che resta quello di Arianna. */
    if (dati && dati.servizio) {
      unlockApp();
      toast('Accesso di servizio.', 'ok', 5000);
      allineaAllAvvio();
      return;
    }
    /* Il server l'ha riconosciuto: da adesso è anche il PIN di questo
       dispositivo. Si scrive senza mandare l'archivio, che sul server
       può essere più avanti: lo rilegge allineaAllAvvio(). */
    db.settings.pinHash = atteso;
    salvaPin();
    unlockApp();
    toast('PIN aggiornato: era stato cambiato su un altro dispositivo.', 'ok', 5000);
    allineaAllAvvio();
  } catch (err) {
    if (pinInput.value !== pin) return;   // si è continuato a scrivere: risposta superata
    if (/troppi tentativi/i.test(err.message)) {
      pinClear(true);
      $('#pinError').hidden = false;
      $('#pinError').textContent = 'Troppi tentativi sbagliati: riprova fra qualche minuto.';
    } else if (/PIN/i.test(err.message)) {
      pinWrong();
    } else {
      /* Server muto: per questo dispositivo il PIN resta sbagliato. */
      pinWrong();
      console.warn('Verifica del PIN sul server non riuscita:', err.message);
    }
  } finally {
    recuperoInCorso = false;
  }
}

/**
 * Il PIN di fabbrica lo conosce chiunque abbia visto l'app installare.
 * Finché non è mai stato cambiato, a ogni ingresso dal tastierino si
 * apre il pannello per farlo. Cambiato una volta, non lo si chiede più:
 * nemmeno se in seguito si sceglie di nuovo 1234.
 */
function chiediPinNuovoSeServe() {
  /* Demo: il PIN resta 1234, non si chiede di cambiarlo. */
  if (!CONFIG.api) return;
  if (db.settings.pinCambiato) return;
  if (db.settings.pinHash !== hashPin(CONFIG.defaultPin)) return;
  $('#formPin').reset();
  $('#pinOld').value = CONFIG.defaultPin;
  openSheet('sheetPin');
  setTimeout(() => $('#pinNew').focus(), 120);
  toast('Scegli un PIN tuo: quello iniziale lo conosce chiunque.', 'warn', 5000);
}

/** Vergine davvero: mai sincronizzato e senza niente dentro. */
function puoRecuperareDalDatabase() {
  return !!CONFIG.api
    && Nuvola.revisione === 0
    && !db.appointments.length && !db.clients.length && !db.expenses.length && !db.incomes.length;
}

let recuperoInCorso = false;

async function recuperaDalDatabase(pin) {
  /* La risposta può metterci qualche secondo: intanto si dice che si
     sta aspettando, e altri tocchi non fanno partire un secondo giro. */
  if (recuperoInCorso) return;
  recuperoInCorso = true;
  $('#pinError').textContent = 'Controllo il PIN sul server…';
  $('#pinError').hidden = false;
  const atteso = hashPin(pin);
  try {
    const risposta = await chiamaApi('stato', { pin: atteso, attesa: 9000 });
    if (!risposta.db) { if (pinInput.value === pin) pinWrong(); return; }

    adottaArchivio(risposta.db, risposta.revisione);
    /* L'archivio arrivato porta con sé il PIN che lo protegge, e
       da adesso è quello di questo dispositivo: chi ha appena
       digitato ha dimostrato di conoscerlo. */
    db.settings.pinHash = atteso;
    salvaPin();

    unlockApp();
    renderSelectOptions();
    renderAll();
    toast('Dati recuperati dal database.', 'ok', 5000);
  } catch (err) {
    /* Il server dice "PIN non riconosciuto" quando è sbagliato
       davvero, ma può anche non rispondere affatto: sono due
       cose diverse e vanno dette in modo diverso, altrimenti si
       finisce a ridigitare un PIN corretto per dieci minuti. */
    if (pinInput.value !== pin) { console.warn('Recupero superato:', err.message); return; }
    if (/troppi tentativi/i.test(err.message)) {
      pinClear(true);
      $('#pinError').hidden = false;
      $('#pinError').textContent = 'Troppi tentativi sbagliati: riprova fra qualche minuto.';
    } else if (/PIN/i.test(err.message)) pinWrong();
    else {
      /* Prima si svuota, poi si scrive: pinClear() nasconde l'avviso, e
         nell'ordine inverso il messaggio spariva prima di essere letto. */
      pinClear(true);
      $('#pinError').hidden = false;
      $('#pinError').textContent = 'Server non raggiungibile: riprova, oppure entra col PIN di questo dispositivo.';
    }
    console.warn('Recupero dal database non riuscito:', err.message);
  } finally {
    recuperoInCorso = false;
  }
}

$('#keypad').addEventListener('click', event => {
  const key = event.target.closest('.key');
  if (!key) return;
  const value = key.dataset.key;
  if (value === 'back') pinClear(false);
  else if (value === 'clear') pinClear(true);
  else pinPush(value);
});

/* Tastiera fisica: utile su desktop, dove il tastierino è un ripiego. */
document.addEventListener('keydown', event => {
  if (state.unlocked || lockScreen.hidden) return;
  if (/^\d$/.test(event.key)) { pinPush(event.key); event.preventDefault(); }
  else if (event.key === 'Backspace') { pinClear(false); event.preventDefault(); }
});

$('#formLock').addEventListener('submit', event => {
  event.preventDefault();
  if (pinInput.value.length < 4) { toast('Il PIN ha almeno 4 cifre.', 'error'); return; }
  tryUnlock();
});

/* ------------------------------------------------------------
   RESTARE DENTRO FRA UN RICARICAMENTO E L'ALTRO

   L'app ripartiva bloccata a ogni ricaricamento: bastava un tocco
   sbagliato, o il browser che ricarica la pagina per conto suo dopo
   un po' in secondo piano, per doversi rifare il PIN — con una
   cliente davanti.

   Adesso il momento dell'ultimo utilizzo resta scritto, e riaprendo
   l'app entro quei minuti si rientra direttamente. Il blocco
   automatico non cambia: e' la stessa finestra di quindici minuti di
   inattivita' di prima, e passata quella si ricomincia dal PIN. Qui
   dentro ci sono anche note di salute — restare aperti per sempre
   non e' una comodita' che valga il prezzo.
   ------------------------------------------------------------ */

const CHIAVE_SBLOCCO = CONFIG.storageKey + '.sblocco';
let ultimaTraccia = 0;

/**
 * Segna che l'app e' in uso adesso.
 *
 * Di norma scrive al massimo una volta ogni mezzo minuto: questa
 * funzione parte a ogni tocco e a ogni tasto, e il localStorage non e'
 * il posto dove fare centinaia di scritture al minuto per un numero
 * che cambia appena. `subito` serve nei due momenti che contano —
 * l'ingresso e l'uscita — dove la scrittura non puo' aspettare.
 */
function segnaAttivita(subito = false) {
  const adesso = Date.now();
  if (!subito && adesso - ultimaTraccia < 30000) return;
  ultimaTraccia = adesso;
  try { localStorage.setItem(CHIAVE_SBLOCCO, String(adesso)); } catch (_) {}
}

function scordaSblocco() {
  ultimaTraccia = 0;
  try { localStorage.removeItem(CHIAVE_SBLOCCO); } catch (_) {}
}

/** Vero se l'ultimo utilizzo e' abbastanza recente da non richiedere il PIN. */
function sbloccoAncoraValido() {
  try {
    const quando = Number(localStorage.getItem(CHIAVE_SBLOCCO)) || 0;
    return quando > 0 && Date.now() - quando < CONFIG.autoLockMinutes * 60000;
  } catch (_) {
    /* Senza localStorage non si puo' sapere: si chiede il PIN. */
    return false;
  }
}

const SEZIONI = ['home', 'agenda', 'clienti', 'conti', 'impostazioni'];

/**
 * La sezione che dice l'indirizzo: aperti su #agenda si torna
 * sull'Agenda, non sulla Home.
 */
function sezioneDallIndirizzo() {
  const nome = location.hash.replace(/^#/, '');
  return SEZIONI.includes(nome) ? nome : 'home';
}

function lockApp(silent = false) {
  /* All'avvio l'app parte bloccata senza essere mai stata aperta:
     li' non c'e' nessuna sessione da chiudere, e chiuderla
     cancellerebbe quella che allineaAllAvvio() sta aprendo. */
  if (state.unlocked) esci();
  state.unlocked = false;
  /* Bloccando si esce davvero: il prossimo avvio ripartira' dal PIN,
     anche se sono passati due secondi. */
  scordaSblocco();
  clearTimeout(idleTimer);
  $$('.sheet').forEach(s => { s.hidden = true; });
  document.body.classList.remove('is-sheet');
  chiudiResoconto();
  shell.hidden = true;
  renderLockGreeting();
  lockScreen.hidden = false;
  document.body.classList.add('is-locked');
  document.documentElement.classList.add('is-locked');
  pinClear(true);
  if (!silent) toast('App bloccata.', 'info', 2000);
}

function unlockApp() {
  state.unlocked = true;
  ripristinaVista();
  lockScreen.hidden = true;
  shell.hidden = false;
  document.body.classList.remove('is-locked');
  document.documentElement.classList.remove('is-locked');
  pinClear(true);
  segnaAttivita(true);
  switchTab(sezioneDallIndirizzo());
  renderAll();
  syncNavHeight();
  resetIdle();
  disegnaStatoNuvola();
  /* I dati sono solo nel database: se non sono ancora arrivati (o la
     lettura all'avvio non è riuscita), si chiedono adesso. */
  if (CONFIG.api && !Nuvola.caricato) allineaAllAvvio();
}

/**
 * Comunica al CSS l'altezza vera della barra di navigazione: cambia con
 * la tacca del telefono e col corpo del testo scelto nelle impostazioni
 * di sistema, e il contenuto deve lasciarle esattamente quello spazio.
 */
function syncNavHeight() {
  const nav = $('.tabbar');
  if (!nav || !nav.offsetHeight) return;
  /* Non basta l'altezza della barra: adesso galleggia staccata dal
     bordo, quindi lo spazio da lasciare al contenuto va dal suo lato
     alto (cerchio della Home compreso) fino in fondo allo schermo. */
  /* Il fondo è quello del body e non window.innerHeight: da app web
     l'iPhone riporta un'altezza più corta dello schermo. */
  const fondo = document.body.getBoundingClientRect().bottom;
  const occupato = Math.max(0, fondo - nav.getBoundingClientRect().top);
  document.documentElement.style.setProperty('--navbar-h', Math.round(occupato) + 'px');
}
window.addEventListener('resize', syncNavHeight);
window.addEventListener('orientationchange', syncNavHeight);

/**
 * Aperta dalla schermata Home l'app occupa tutto lo schermo, ma l'iPhone
 * calcola il 100% d'altezza togliendo la fascia dell'ora: tutto finiva
 * più corto, e la barra in basso galleggiava a metà strada. Qui l'app
 * prende l'altezza dello schermo intero, che in questa modalità è sua.
 */
const isStandalone = window.navigator.standalone === true ||
  (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

function fitStandalone() {
  if (!isStandalone || window.top !== window.self) return;
  const verticale = !window.matchMedia || matchMedia('(orientation: portrait)').matches;
  const schermo = verticale
    ? Math.max(screen.height, screen.width)
    : Math.min(screen.height, screen.width);
  const altezza = Math.max(window.innerHeight, schermo || 0);
  document.documentElement.style.setProperty('--app-h', altezza + 'px');
  syncNavHeight();
}
if (isStandalone) {
  document.documentElement.classList.add('is-standalone');
  window.addEventListener('resize', fitStandalone);
  window.addEventListener('orientationchange', () => setTimeout(fitStandalone, 250));
}

/**
 * Rete di sicurezza per quando l'app vive dentro un riquadro incorporato
 * più alto della parte che si vede davvero — succede se chi ospita la
 * pagina dimensiona il riquadro sul contenuto invece che sullo schermo.
 * In quel caso "tutto lo schermo" per l'app è il riquadro intero: la
 * barra in basso finisce sotto il bordo visibile e i pannelli si aprono
 * dove nessuno li vede, e sembra che i comandi non rispondano.
 *
 * IntersectionObserver riporta quanta parte del riquadro è realmente in
 * vista, anche se la pagina che ci ospita è di un altro dominio: l'app
 * si ridimensiona a quella. In una pagina normale non entra mai in gioco.
 */
function fitToVisibleArea() {
  if (window.top === window.self || !('IntersectionObserver' in window)) return;

  const applica = entries => {
    const visibile = Math.round(entries[0].intersectionRect.height);
    /* Solo davanti a uno scarto vero: sotto i 48px non vale la pena, e
       sotto i 240px visibili si tratta di un riquadro appena entrato
       nello schermo, non della sua misura definitiva. */
    if (visibile >= 240 && window.innerHeight - visibile > 48) {
      document.documentElement.style.setProperty('--app-h', visibile + 'px');
    } else {
      document.documentElement.style.removeProperty('--app-h');
    }
    syncNavHeight();
  };

  try {
    new IntersectionObserver(applica, { threshold: [0, .05, .25, .5, .75, .95, 1] })
      .observe(document.documentElement);
  } catch (err) {
    console.info('Adattamento all\'area visibile non disponibile:', err.message);
  }
}

/** Blocco automatico: il telefono resta spesso appoggiato sul tavolo. */
function resetIdle() {
  if (!state.unlocked) return;
  segnaAttivita();
  clearTimeout(idleTimer);
  /* Demo: niente blocco automatico per inattività. */
}
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(evt =>
  document.addEventListener(evt, resetIdle, { passive: true })
);

$('#btnLock').addEventListener('click', () => lockApp());
$('#menuLock').addEventListener('click', () => lockApp());

/* --- Navigazione a schede -------------------------------- */
function switchTab(name) {
  $$('.tab').forEach(t => {
    const active = t.dataset.tab === name;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', String(active));
  });
  $$('.panel').forEach(p => p.classList.toggle('is-active', p.id === `panel-${name}`));
  /* Si riparte dall'alto: arrivando da una pagina lunga, la nuova
     schermata si aprirebbe già scorsa a metà. A scorrere adesso è la
     fascia del contenuto, non la finestra. */
  const box = $('.content');
  if (box) box.scrollTop = 0;
  /* Il grafico si può centrare solo adesso che la scheda è visibile:
     a pannello nascosto le larghezze sono zero e il conto non si fa. */
  if (name === 'conti') centerChartOnToday();
}
/* L'indirizzo segue la sezione: #agenda mentre si guarda l'Agenda.
   Cosi' il tasto "indietro" torna alla sezione precedente invece di
   uscire dall'app, e un indirizzo messo fra i preferiti riapre il
   punto giusto. Con un frammento (#) e non un percorso: l'app è una
   pagina sola, e /agenda sul server non esiste.

   La pagina non si ricarica: cambia solo quello che c'e' scritto nella
   barra degli indirizzi. */
function segnaSezione(name, nuovaVoce = true) {
  if (!window.history || !SEZIONI.includes(name)) return;
  const meta = name === 'home' ? location.pathname + location.search : '#' + name;
  if (sezioneDallIndirizzo() === name && history.state && history.state.sezione === name) return;
  history[nuovaVoce ? 'pushState' : 'replaceState']({ sezione: name }, '', meta);
}

$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  switchTab(tab.dataset.tab);
  segnaSezione(tab.dataset.tab);
}));

/* "Indietro" e "avanti" del browser riportano alla sezione di quella
   voce. Senza questo, la barra degli indirizzi cambierebbe e la pagina
   resterebbe dov'era. */
window.addEventListener('popstate', evento => {
  switchTab((evento.state && evento.state.sezione) || sezioneDallIndirizzo());
});
$$('[data-goto]').forEach(btn => btn.addEventListener('click', () => {
  switchTab(btn.dataset.goto);
  segnaSezione(btn.dataset.goto);
}));

/* ============================================================
   10. RENDERING
   ============================================================ */

function renderAll() {
  if (!state.unlocked) return;
  renderHome();
  renderCalendar();
  renderDayList();
  renderClients();
  renderConti();
  renderIncomes();
  renderExpenses();
}

/* --- Mattoncini condivisi -------------------------------- */

/** Riga di un appuntamento: ora, nome, servizio, pallino di stato. */
function apptRow(a, opts = {}) {
  /* Sotto l'ora d'inizio, in piccolo, quella di fine: guardando
     l'elenco la domanda è sempre quella, da che ora sono libera.
     Prende il posto della durata, che per rispondere andava sommata
     a mente. La freccia è la stessa del dettaglio. */
  const quando = opts.showDate
    ? `<b>${esc(fmtDayMini.format(fromKey(a.data)))}</b><span>${esc(a.ora)} → ${esc(endTime(a))}</span>`
    : `<b>${esc(a.ora)}</b><span>→ ${esc(endTime(a))}</span>`;

  return `<li>
    <button class="row" type="button" data-appt="${a.id}">
      <span class="row__time">${quando}</span>
      <span class="row__main">
        <span class="row__title">${esc(clientLabel(a))}</span>
        <span class="row__sub">${esc(a.servizio)}</span>
      </span>
      <span class="row__end">
        <i class="dot dot--${a.stato}" title="${STATI[a.stato] ? STATI[a.stato].label : ''}"></i>
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
      </span>
    </button>
  </li>`;
}

/* --- Home ------------------------------------------------ */
function renderHome() {
  const now = new Date();
  const todayKey = toKey(now);

  $('#helloTitle').innerHTML = (CONFIG.nome ? `Ciao, ${esc(CONFIG.nome)}!` : 'Ciao!') +
    ' <span aria-hidden="true">👋</span>';
  $('#helloSub').textContent = capitalize(fmtDayFull.format(now));

  /* Da segnare: già finiti e mai segnati completati. Senza questo
     blocco sparivano dalla Home il giorno dopo, e con loro l'incasso
     dai Conti, senza che nessuno se ne accorgesse. */
  const adessoMin = now.getHours() * 60 + now.getMinutes();
  const finito = a => String(a.data) < todayKey ||
    (a.data === todayKey && toMinutes(a.ora) + (Number(a.durata) || 0) <= adessoMin);
  const daSegnare = db.appointments
    .filter(a => a.stato !== 'done' && finito(a))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || toMinutes(b.ora) - toMinutes(a.ora));
  renderPending(daSegnare);

  /* Prossimi appuntamenti: da oggi in avanti, e solo quelli ancora da
     fare. Segnato completato, l'appuntamento ha finito di essere una
     cosa in programma: sparisce da qui e resta in Agenda, nello storico
     della cliente e nei Conti, dove lo si va a cercare. */
  const prossimi = db.appointments
    .filter(a => String(a.data) >= todayKey && a.stato !== 'done' && !finito(a))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || toMinutes(a.ora) - toMinutes(b.ora))
    .slice(0, CONFIG.upcomingCount);

  if (!prossimi.length) {
    $('#homeUpcoming').innerHTML = '<li class="empty">Niente in programma.</li>';
    return;
  }

  /*
    Raggruppati per mese e per giorno. L'intestazione porta la data una
    volta sola, così la riga può tenere l'ora grande: in un elenco lungo
    è l'ora che si cerca, la data la dà il gruppo in cui si trova.
  */
  let html = '';
  let mese = '';
  let giorno = '';

  prossimi.forEach(a => {
    const data = fromKey(a.data);
    const chiaveMese = String(a.data).slice(0, 7);

    if (chiaveMese !== mese) {
      mese = chiaveMese;
      giorno = '';                       // nuovo mese: ricomincia dai giorni
      html += `<li class="grouphead grouphead--month">${esc(capitalize(fmtMonth.format(data)))}</li>`;
    }
    if (a.data !== giorno) {
      giorno = a.data;
      html += `<li class="grouphead">${esc(etichettaGiorno(a.data))}</li>`;
    }
    html += apptRow(a);
  });

  $('#homeUpcoming').innerHTML = html;
}

/* Quanti "da segnare" si vedono prima di "Mostra tutti": un archivio
   importato può portarne decine, e la Home resta la Home. */
const PENDING_VISIBILI = 4;
let pendingTutti = false;

function renderPending(list) {
  const wrap = $('#homePendingWrap');
  wrap.hidden = !list.length;
  /* Il primo titolo della schermata non ha niente sopra da cui staccarsi. */
  $('#homeUpcomingHead').classList.toggle('sectionhead--first', !list.length);
  if (!list.length) { pendingTutti = false; $('#homePending').innerHTML = ''; return; }

  const visibili = pendingTutti ? list : list.slice(0, PENDING_VISIBILI);
  /* La riga apre il dettaglio come ovunque; la spunta dentro la riga,
     nel quadratino come Modifica ed Elimina, è la scorciatoia per la
     cosa che si fa quasi sempre. Un pulsante dentro un pulsante non si
     può: la riga qui è un elemento che si comporta da pulsante. */
  $('#homePending').innerHTML = visibili.map(a => `<li>
      <div class="row" role="button" tabindex="0" data-appt="${a.id}">
        <span class="row__time">
          <b>${esc(fmtDayMini.format(fromKey(a.data)))}</b>
          <span>${esc(a.ora)} → ${esc(endTime(a))}</span>
        </span>
        <span class="row__main">
          <span class="row__title">${esc(clientLabel(a))}</span>
          <span class="row__sub">${esc(a.servizio)}</span>
        </span>
        <span class="row__acts">
          <button class="rowact rowact--done" type="button" data-done="${a.id}" aria-label="Segna completato: ${esc(clientLabel(a))}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
          </button>
        </span>
      </div>
    </li>`).join('') +
    (list.length > visibili.length
      ? `<li><button class="linkbtn linkbtn--center" type="button" data-pending-all>Mostra tutti (${list.length})</button></li>`
      : '');
}

/* --- Calendario ------------------------------------------ */
/** Celle di un intervallo di giorni, forma condivisa fra striscia e mese. */
function dayCells(start, count, monthRef) {
  const todayKey = toKey(new Date());
  let html = '';

  for (let i = 0; i < count; i++) {
    const day = addDays(start, i);
    const key = toKey(day);
    const appts = apptsByDay(key);

    const classes = ['day'];
    if (monthRef !== null && day.getMonth() !== monthRef) classes.push('day--out');
    /* I giorni di chiusura si vedono dal calendario: la disponibilità
       della settimana si capisce senza aprire una giornata per volta. */
    if (key === todayKey) classes.push('day--today');
    if (key === state.selected) classes.push('day--sel');
    /* Dagli orari di lavoro: chiusura in grigio, e da oggi in avanti
       le giornate senza più nemmeno mezz'ora libera segnate piene. */
    const chiuso = !turniDelGiorno(key).length;
    const pieno = !chiuso && key >= todayKey && !slotLiberi(key, DURATA_MINIMA).length;
    if (chiuso) classes.push('day--closed');
    if (pieno) classes.push('day--full');

    /* Un pallino per ogni stato presente quel giorno: il colore dice
       cosa c'è da fare senza aprire la giornata. */
    const dots = ['wait', 'done']
      .filter(st => appts.some(a => a.stato === st))
      .map(st => `<span class="day__dot day__dot--${st}"></span>`)
      .join('');

    const aria = `${fmtDayLong.format(day)}: ` + (appts.length
      ? `${appts.length} appuntamenti${pieno ? ', pieno' : ''}`
      : (chiuso ? 'chiuso' : 'libero'));

    html += `<button type="button" class="${classes.join(' ')}" data-date="${key}" aria-label="${aria}">
               <span class="day__n">${day.getDate()}</span><span class="day__dots">${dots}</span>
             </button>`;
  }
  return html;
}

/**
 * Il mese intero, in quante settimane servono davvero: cinque per la
 * maggior parte dei mesi, sei solo quando il primo cade tardi. Una
 * sesta riga tutta del mese dopo sarebbe spazio buttato.
 */
function renderCalendar() {
  const first = startOfMonth(state.month);
  const offset = (first.getDay() + 6) % 7;                       // lunedì = 0
  const giorniMese = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const celle = Math.ceil((offset + giorniMese) / 7) * 7;

  $('#calGrid').innerHTML = dayCells(startOfWeek(first), celle, first.getMonth());
  $('#periodLabel').textContent = capitalize(fmtMonth.format(first));
  segnaVista();
}

/* --- Giornata -------------------------------------------- */
function renderDayList() {
  const day = fromKey(state.selected);
  const oggi = state.selected === toKey(new Date());
  $('#dayLabel').textContent = oggi ? 'Oggi' : capitalize(fmtDayLong.format(day));

  const all = apptsByDay(state.selected);

  /* Le card in fila, dalla prima all'ultima. apptsByDay le restituisce
     gia' in ordine di orario: l'ordine dell'elenco e' l'ordine della
     giornata, e non serve altro per leggerla.

     Prima qui c'era una colonna con la scala delle ore, dove ogni card
     era alta quanto durava. Diceva di piu' — a colpo d'occhio si
     vedevano i buchi — ma per sapere dove finiva la giornata doveva
     sapere quando cominciava, e quindi chiedere gli orari di lavoro.
     Tolti quelli, resta la cosa che conta: chi viene, e in che
     ordine. */
  $('#dayList').innerHTML = all.length
    ? all.map(a => apptRow(a)).join('')
    : `<li class="empty">Nessun appuntamento ${oggi ? 'oggi' : 'in questa giornata'}.</li>`;
}

/* --- Clienti --------------------------------------------- */
function renderClients() {
  const q = state.clientQuery.trim().toLowerCase();
  let rows = db.clients.map(c => ({ client: c, stats: clientStats(c.id) }));

  if (q) {
    rows = rows.filter(({ client }) =>
      clientFullName(client).toLowerCase().includes(q) ||
      (normPhone(q) && normPhone(client.telefono).includes(normPhone(q))) ||
      String(client.note || '').toLowerCase().includes(q)
    );
  }

  /* Ordine alfabetico e basta: è come si cerca una persona in una
     rubrica, e la ricerca sopra copre tutto il resto. */
  rows.sort((a, b) => clientFullName(a.client).localeCompare(clientFullName(b.client), 'it'));

  if (!rows.length) {
    $('#clientsList').innerHTML = `<li class="empty">${
      db.clients.length ? 'Nessuna cliente corrisponde alla ricerca.'
                        : 'Anagrafica vuota: si popola da sola al primo appuntamento salvato.'
    }</li>`;
    return;
  }

  /* La riga porta il dato coerente con l'ordinamento scelto: ordinando
     per spesa è la spesa che si vuole confrontare, non il conteggio. */
  /* Il sottotitolo è il telefono: visite e spesa stanno nella scheda,
     che è il posto in cui si va a guardarle. */
  $('#clientsList').innerHTML = rows.map(({ client }) => {
    const sub = client.telefono || '';
    return `<li>
      <button class="row" type="button" data-client="${client.id}">
        <span class="avatar" aria-hidden="true">${esc(initials(client))}</span>
        <span class="row__main">
          <span class="row__title">${esc(clientFullName(client))}</span>
          <span class="row__sub">${esc(sub)}</span>
        </span>
        <span class="row__end">
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
        </span>
      </button>
    </li>`;
  }).join('');
}

/* --- Conti ----------------------------------------------- */
function renderConti() {
  const years = knownYears();
  if (!years.includes(state.year)) state.year = years[0];
  $('#balanceYear').innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  $('#balanceYear').value = String(state.year);

  const rows = yearRows(state.year);
  const totIn = sum(rows, 'incassi');
  const totOut = sum(rows, 'uscite');
  const totTr = rows.reduce((s, r) => s + r.trattamenti, 0);
  const netto = totIn - totOut;

  $('#statYearName').textContent = state.year;
  $('#balNet').textContent = fmtSigned(netto);
  $('#balNet').classList.toggle('neg', netto < 0);
  $('#balCount').textContent = totTr;
  /* Senza trattamenti non c'è una media da fare: un "0 €" direbbe
     che si lavora gratis invece che dire che non si è lavorato. */
  $('#balAvg').textContent = totTr ? fmtEuro(sum(rows, 'daTrattamenti') / totTr) : '—';

  $('#balIn').textContent = fmtEuro(totIn);
  $('#balOut').textContent = fmtEuro(totOut);

  renderChart(rows);
  renderBalanceTable(rows, { totIn, totOut, totTr });
}

/**
 * Barre affiancate: due misure nella stessa unità (€) su un unico asse,
 * mai due scale diverse. I valori esatti stanno nella tabella qui sotto,
 * che è anche la versione accessibile del grafico.
 */
function renderChart(rows) {
  /* Un anno senza movimenti non ha niente da disegnare: una scala da
     zero a un euro sopra barre piatte sembrava un grafico rotto. */
  if (!rows.some(r => r.incassi || r.uscite)) {
    $('#chart').innerHTML = `<p class="chart__empty">Nessun movimento nel ${state.year}.</p>`;
    return;
  }
  const max = Math.max(1, ...rows.map(r => Math.max(r.incassi, r.uscite)));
  const step = niceStep(max / 3);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const nowMonth = new Date().getFullYear() === state.year ? new Date().getMonth() : -1;

  let grid = '';
  let scale = '';
  for (let v = 0; v <= top + 0.001; v += step) {
    const bottom = (v / top) * 100;
    grid  += `<div class="chart__gridline" style="bottom:${bottom}%"></div>`;
    scale += `<span style="bottom:${bottom}%">${fmtEuroTondo(v)}</span>`;
  }

  const bars = rows.map(r => {
    const tip = `${capitalize(MESI_LUNGHI[r.mese])}: guadagni ${fmtEuro(r.incassi)}, spese ${fmtEuro(r.uscite)}`;
    return `<div class="chart__group" title="${esc(tip)}">
      <div class="chart__bar chart__bar--in"  style="height:${(r.incassi / top) * 100}%"></div>
      <div class="chart__bar chart__bar--out" style="height:${(r.uscite / top) * 100}%"></div>
    </div>`;
  }).join('');

  const axis = rows.map(r =>
    `<span class="${r.mese === nowMonth ? 'is-now' : ''}">${MESI_BREVI[r.mese]}</span>`
  ).join('');

  $('#chart').innerHTML = `
    <div class="chart__yaxis" aria-hidden="true">${scale}</div>
    <div class="chart__scroll">
      <div class="chart__inner">
        <div class="chart__plot">${grid}<div class="chart__bars">${bars}</div></div>
        <div class="chart__axis">${axis}</div>
      </div>
    </div>`;

  centerChartOnToday();
}

/** Su telefono il grafico scorre: porta in vista il mese corrente. */
function centerChartOnToday() {
  if (new Date().getFullYear() !== state.year) return;
  const scroller = $('#chart .chart__scroll');
  const group = $$('#chart .chart__group')[new Date().getMonth()];
  if (!scroller || !group) return;
  if (scroller.scrollWidth <= scroller.clientWidth) return;
  scroller.scrollLeft = Math.max(0, group.offsetLeft - scroller.clientWidth / 2 + group.offsetWidth / 2);
}

function renderBalanceTable(rows, totals) {
  const nowMonth = new Date().getFullYear() === state.year ? new Date().getMonth() : -1;

  $('#balanceTable').innerHTML = `
    <thead>
      <tr><th>Mese</th><th>Guadagni</th><th>Spese</th><th>Netto</th></tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr class="${r.mese === nowMonth ? 'is-now' : ''}">
        <td>${capitalize(MESI_LUNGHI[r.mese])}</td>
        <td class="num">${fmtEuro(r.incassi)}</td>
        <td class="num">${fmtEuro(r.uscite)}</td>
        <td class="num${r.netto < 0 ? ' neg' : ''}">${fmtSigned(r.netto)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td>Totale</td>
        <td class="num">${fmtEuro(totals.totIn)}</td>
        <td class="num">${fmtEuro(totals.totOut)}</td>
        <td class="num${totals.totIn - totals.totOut < 0 ? ' neg' : ''}">${fmtSigned(totals.totIn - totals.totOut)}</td>
      </tr>
    </tfoot>`;
}

/* --- Elenchi di guadagni e spese ---------------------------
   Tutti e due guardano l'anno scelto in Conti, e si possono
   stringere a un mese. Stessa impaginazione: un gruppo per mese,
   col suo totale accanto, e il totale di ciò che si vede in cima. */

/** Il menu dei mesi dell'anno scelto: solo quelli con qualcosa, più il mese corrente. */
function renderMonthMenu(select, date, chiaveStato, etichettaTutto) {
  const oggi = toKey(new Date()).slice(0, 7);
  const anno = String(state.year);
  const mesi = [...new Set([...(oggi.startsWith(anno) ? [oggi] : []), ...date.map(d => String(d).slice(0, 7))])]
    .filter(m => m.startsWith(anno)).sort().reverse();

  select.innerHTML = `<option value="all">${esc(etichettaTutto)} ${anno}</option>` +
    mesi.map(m => `<option value="${m}">${esc(nomeMese(m))}</option>`).join('');
  if (state[chiaveStato] !== 'all' && !mesi.includes(state[chiaveStato])) state[chiaveStato] = 'all';
  select.value = state[chiaveStato];
  return state[chiaveStato] === 'all' ? anno : state[chiaveStato];
}

/** Righe raggruppate per mese: ogni voce ha `data` e `importo`, e `riga` la disegna. */
function righePerMese(list, riga) {
  let html = '';
  let mese = '';
  list.forEach(x => {
    const chiaveMese = String(x.data).slice(0, 7);
    if (chiaveMese !== mese) {
      mese = chiaveMese;
      const totMese = list.filter(y => String(y.data).startsWith(chiaveMese)).reduce((s, y) => s + y.importo, 0);
      html += `<li class="grouphead grouphead--month">
        <span>${esc(nomeMese(chiaveMese))}</span>
        <span class="grouphead__tot">${fmtEuro(totMese)}</span>
      </li>`;
    }
    html += riga(x);
  });
  return html;
}

/**
 * Riga dei Conti: data, descrizione e importo, da leggere. Non si
 * apre: accanto ci sono i due soli comandi che servono, modifica ed
 * elimina. `tipo` dice di che cosa si tratta: 'appt' (trattamento
 * dall'Agenda), 'inc' (guadagno a mano), 'exp' (spesa).
 */
function rigaConti(x, tipo, titolo, sotto, verso) {
  const giorno = fromKey(x.data);
  return `<li>
    <div class="row row--static">
      <span class="row__date">
        <b>${giorno.getDate()}</b>
        <span>${MESI_BREVI[giorno.getMonth()]}</span>
      </span>
      <span class="row__main">
        <span class="row__title">${esc(titolo)}</span>
        ${sotto ? `<span class="row__sub">${esc(sotto)}</span>` : ''}
        <span class="row__amount row__amount--${verso}">${verso === 'in' ? '+' : '−'}${fmtEuro(x.importo)}</span>
      </span>
      <span class="row__acts">
        <button class="rowact" type="button" data-conto="edit" data-tipo="${tipo}" data-id="${esc(x.id)}"
                aria-label="Modifica ${esc(titolo)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-4-4l-10 10v4Z"/><path d="m13.5 6.5 4 4"/></svg></button>
        <button class="rowact rowact--del" type="button" data-conto="del" data-tipo="${tipo}" data-id="${esc(x.id)}"
                aria-label="Elimina ${esc(titolo)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v5.5M13.5 10.5v5.5"/></svg></button>
      </span>
    </div>
  </li>`;
}

/* Un solo gestore per i due elenchi dei Conti. */
async function azioneConto(event) {
  const btn = event.target.closest('[data-conto]');
  if (!btn) return;
  const { conto, tipo, id } = btn.dataset;
  if (tipo === 'appt') {
    if (conto === 'edit') editAppointment(id);
    else await deleteAppointment(id);
  } else if (tipo === 'inc') {
    const inc = db.incomes.find(i => i.id === id);
    if (conto === 'edit' && inc) openIncomeForm(inc);
    else if (conto === 'del') await deleteIncome(id);
  } else if (tipo === 'exp') {
    const exp = db.expenses.find(e => e.id === id);
    if (conto === 'edit' && exp) openExpenseForm(exp);
    else if (conto === 'del') await deleteExpense(id);
  }
}

function renderIncomes() {
  /* Ogni appuntamento completato ha il suo guadagno, e nell'elenco
     compare quello: matita e cestino lavorano sul guadagno. Un
     completato rimasto senza (non dovrebbe succedere) si mostra
     comunque, per non far sparire soldi dal conto. */
  const senzaGuadagno = db.appointments.filter(a => a.stato === 'done' && !guadagnoDi(a.id));
  const periodo = renderMonthMenu($('#incomeMonth'),
    [...senzaGuadagno.map(a => a.data), ...db.incomes.map(i => i.data)], 'incomeMonth', 'Tutto il');

  const dentro = d => String(d).startsWith(periodo);
  const apptDi = i => i.appuntamentoId ? db.appointments.find(a => a.id === i.appuntamentoId) : null;
  const list = [
    ...senzaGuadagno.filter(a => dentro(a.data)).map(a => ({ tipo: 'appt', id: a.id, data: a.data, ora: a.ora, importo: Number(a.prezzo) || 0, a })),
    ...db.incomes.filter(i => dentro(i.data)).map(i => {
      const a = apptDi(i);
      return { tipo: 'inc', id: i.id, data: i.data, ora: a ? a.ora : '', importo: Number(i.importo) || 0, i, a };
    })
  ].sort((x, y) => (y.data + y.ora).localeCompare(x.data + x.ora));

  $('#incomesPeriod').textContent = periodo.length === 4 ? `Guadagni del ${periodo}` : `Guadagni di ${nomeMese(periodo).toLowerCase()}`;
  $('#incomesTotal').textContent = fmtEuro(list.reduce((s, x) => s + x.importo, 0));

  /* Del trattamento contano chi e che cosa; del guadagno a mano la
     descrizione. Sotto, il metodo di pagamento se c'è. */
  const sotto = (...pezzi) => pezzi.filter(Boolean).join(' · ');
  $('#incomesList').innerHTML = righePerMese(list, x => {
    if (x.tipo === 'appt') return rigaConti(x, 'appt', clientLabel(x.a), x.a.servizio || '', 'in');
    if (x.a) return rigaConti(x, 'inc', x.i.cliente || clientLabel(x.a), sotto(x.i.descrizione, x.i.metodo), 'in');
    return rigaConti(x, 'inc', incomeTitle(x.i), sotto(x.i.cliente, x.i.metodo), 'in');
  }) || '<li class="empty">Nessun guadagno in questo periodo.</li>';
}

function renderExpenses() {
  const periodo = renderMonthMenu($('#expenseMonth'), db.expenses.map(e => e.data), 'expenseMonth', 'Tutto il');

  const list = db.expenses
    .filter(e => String(e.data).startsWith(periodo))
    .map(e => Object.assign({}, e, { importo: Number(e.importo) || 0 }))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  $('#expensesPeriod').textContent = periodo.length === 4 ? `Spese del ${periodo}` : `Spese di ${nomeMese(periodo).toLowerCase()}`;
  $('#expensesTotal').textContent = fmtEuro(list.reduce((s, e) => s + e.importo, 0));

  $('#expensesList').innerHTML = righePerMese(list, e => rigaConti(e, 'exp', e.descrizione, '', 'out'))
    || '<li class="empty">Nessuna spesa in questo periodo.</li>';
}

/* ============================================================
   11. PANNELLI
   ============================================================ */

/* --- Menu a tendina generati dai dati -------------------- */
/** Riempie il menu delle durate, aggiungendo quella in uso se manca. */
function renderDurate(valore) {
  const scelto = Number(valore) || Number($('#fDurata').value) || 0;
  const voci = DURATE.includes(scelto) || !scelto ? DURATE : [...DURATE, scelto].sort((a, b) => a - b);
  $('#fDurata').innerHTML = voci
    .map(m => `<option value="${m}">${m} min</option>`).join('');
  if (scelto) $('#fDurata').value = String(scelto);
}

/* --- Prestazione aggiuntiva -------------------------------
   Il servizio principale si sceglie dal primo menu (es. mani); dal
   secondo, con lo stesso elenco, l'altra prestazione fatta nello
   stesso appuntamento (es. piedi). Il principale non vi compare.
   Nei dati resta un elenco (`aggiuntivi`), qui se ne sceglie una. */

/** Gli id delle prestazioni aggiuntive scelte nel modulo. */
function leggiAggiuntivi() {
  const id = $('#fAggiuntivo').value;
  return id ? [id] : [];
}

/** Riempie il menu: "Nessuna", le voci in uso, e quella già scelta se spenta nel frattempo. */
function renderAggiuntivi(scelti = []) {
  const principale = $('#fServizio').value;
  const scelto = scelti.find(id => id !== principale) || '';
  const voci = db.services.filter(s => s.id !== principale && (s.attivo || s.id === scelto));
  $('#fAggiuntivo').innerHTML = '<option value="">Nessuna</option>' + voci
    .map(s => `<option value="${esc(s.id)}">${esc(s.nome)}${s.attivo ? '' : ' (non più in uso)'}</option>`)
    .join('');
  $('#fAggiuntivo').value = scelto;
}

/** Prezzo da listino: principale più le aggiuntive. Resta correggibile. */
function prezzoDaListino() {
  const ids = [$('#fServizio').value, ...leggiAggiuntivi()];
  return ids.reduce((tot, id) => {
    const s = db.services.find(x => x.id === id);
    return tot + (s ? Number(s.prezzo) || 0 : 0);
  }, 0);
}

/* Scegliere la prestazione aggiuntiva aggiorna il prezzo. La durata
   no: quanto dura tutto insieme lo sceglie Arianna. */
$('#fAggiuntivo').addEventListener('change', () => {
  $('#fPrezzo').value = prezzoDaListino();
});

function renderSelectOptions() {
  /* Solo le voci in uso; se sono state spente tutte mostro comunque
     l'intero listino, altrimenti il form sarebbe inutilizzabile. */
  const attivi = db.services.filter(s => s.attivo);
  const voci = attivi.length ? attivi : db.services;

  const scelto = $('#fServizio').value;
  $('#fServizio').innerHTML = voci
    .map(s => `<option value="${s.id}">${esc(s.nome)}</option>`)
    .join('');
  if (scelto && voci.some(s => s.id === scelto)) $('#fServizio').value = scelto;
  renderAggiuntivi(leggiAggiuntivi());

  riempiSelect($('#eCategoria'), db.settings.categorieSpese);
  renderNegoziMenu();
  riempiSelect($('#iCategoria'), db.settings.categorieEntrate);
}

/**
 * Riempie una <select> con una lista di nomi. Se il valore scelto non è
 * più in elenco (categoria tolta dopo) lo aggiunge lo stesso, così
 * modificare una vecchia spesa non le cambia la categoria sotto mano —
 * come fa il menu dei negozi.
 */
function riempiSelect(sel, nomi, scelto) {
  if (!sel) return;
  const corrente = scelto !== undefined ? scelto : sel.value;
  const lista = [...(nomi || [])];
  if (corrente && !lista.some(n => n.toLowerCase() === corrente.toLowerCase())) lista.push(corrente);
  sel.innerHTML = lista.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  sel.value = lista.find(n => n.toLowerCase() === String(corrente || '').toLowerCase()) || lista[0] || '';
}

/* --- Form appuntamento ----------------------------------- */
const formAppt = $('#formAppt');

/**
 * Riga di servizio del form: quanto è occupata quella giornata e, se
 * l'ora scelta si accavalla, con chi. La giornata per intero si guarda
 * in Agenda, che è il posto in cui è fatta per stare.
 */
function renderApptHint() {
  const riga = $('#apptHint');
  const data = $('#fData').value;
  riga.classList.remove('is-clash');
  if (!data) { riga.textContent = ''; riga.hidden = true; return; }

  const ora = $('#fOra').value;
  const durata = Number($('#fDurata').value) || 0;
  const scontri = (ora && durata)
    ? findConflicts({ data, ora, durata }, $('#apptId').value || null) : [];

  if (scontri.length) {
    riga.hidden = false;
    riga.textContent = 'Si sovrappone a ' +
      scontri.map(c => `${c.ora} ${clientLabel(c)}`).join(' · ');
    riga.classList.add('is-clash');
    return;
  }

  /* Un orario scritto a mano può stare fuori dall'orario di lavoro:
     si lascia fare, ma lo si dice. */
  const turni = turniDelGiorno(data);
  const inizio = toMinutes(ora);
  const fuori = ora && durata && !turni.some(([s, e]) => inizio >= s && inizio + durata <= e);
  riga.hidden = !fuori;
  riga.textContent = fuori
    ? (turni.length
        ? `Fuori dal tuo orario di lavoro (${turni.map(([s, e]) => `${toHHMM(s)}–${toHHMM(e)}`).join(', ')}).`
        : 'È un giorno di chiusura.')
    : '';
}

/**
 * La griglia degli orari liberi del giorno scelto. Si ridisegna a ogni
 * cambio di data, durata o eccezione. L'orario in uso (fOra) resta la
 * sola verità: un quadratino toccato lo scrive, e "Altro orario" lascia
 * scriverlo a mano per i casi fuori regola.
 */
function renderSlots() {
  const data = $('#fData').value;
  const durata = Number($('#fDurata').value) || 0;
  const eccezione = ritoccoVeloce();
  const ignoreId = $('#apptId').value || null;
  const info = $('#slotInfo');
  const griglia = $('#slotGrid');

  if (!data || !durata) { info.textContent = ''; griglia.innerHTML = ''; griglia.dataset.firma = ''; return; }

  const aperto = turniDelGiorno(data).length > 0;
  const giorno = GIORNI[fromKey(data).getDay()].toLowerCase();
  const slot = slotLiberi(data, durata, { ignoreId, eccezione });
  const ora = $('#fOra').value;

  /* Una riga solo quando non c'è niente da toccare: con i quadratini
     davanti, ripetere le fasce libere a parole non serve. */
  info.textContent = !aperto ? `Di ${giorno} sei chiusa.`
    : !slot.length ? `Nessun orario libero da ${durata} minuti.`
    : '';

  /* La griglia si riscrive solo se gli orari sono cambiati davvero.
     Toccando un quadratino il campo data perde il fuoco e può
     rilanciare questo calcolo: riscriverla in quel momento toglieva il
     bottone da sotto il dito, e il tocco andava perso. */
  const firma = `${data}|${durata}|${slot.join(',')}`;
  if (griglia.dataset.firma !== firma) {
    griglia.dataset.firma = firma;
    griglia.innerHTML = slot.map(t => {
      const hhmm = toHHMM(t);
      return `<button type="button" class="slot" data-slot="${hhmm}" role="radio" aria-checked="false">
                <b>${hhmm}</b><span>→ ${toHHMM(t + durata)}</span>
              </button>`;
    }).join('');
  }
  $$('.slot', griglia).forEach(b => {
    const sel = b.dataset.slot === ora;
    b.classList.toggle('is-sel', sel);
    b.setAttribute('aria-checked', String(sel));
  });

  /* Un orario che non è fra i quadratini (scritto a mano, o quello di
     un appuntamento che si sta modificando) resta visibile nel campo. */
  const aMano = !!ora && !slot.some(t => toHHMM(t) === ora);
  if (aMano) mostraOraManuale(true);
}

/**
 * Ritocco veloce (una sola unghia, chiesto dalla cliente): non è un
 * interruttore, lo dice la durata. Sotto la mezz'ora valgono anche i
 * buchi stretti e i ritagli; da mezz'ora in su le regole normali.
 */
function ritoccoVeloce() {
  return (Number($('#fDurata').value) || 0) < DURATA_MINIMA;
}

function mostraOraManuale(aperta) {
  $('#slotManualWrap').hidden = !aperta;
  $('#slotManual').hidden = aperta;
}

$('#slotGrid').addEventListener('click', event => {
  const btn = event.target.closest('[data-slot]');
  if (!btn) return;
  $('#fOra').value = btn.dataset.slot;
  $('#fOra').closest('.slotfield').classList.remove('is-invalid');
  mostraOraManuale(false);
  renderSlots();
  renderApptHint();
});

$('#slotManual').addEventListener('click', () => {
  mostraOraManuale(true);
  $('#fOra').focus();
});

/** Ridisegna tutto quello che dipende da data, durata ed eccezione. */
function aggiornaOrari() {
  /* L'orario scelto prima può non esserci più fra quelli liberi: se
     era un quadratino si toglie, se era scritto a mano resta. */
  const ora = $('#fOra').value;
  if (ora && $('#slotManualWrap').hidden) {
    const ancora = slotLiberi($('#fData').value, Number($('#fDurata').value) || 0,
      { ignoreId: $('#apptId').value || null, eccezione: ritoccoVeloce() });
    if (!ancora.some(t => toHHMM(t) === ora)) $('#fOra').value = '';
  }
  renderSlots();
  renderApptHint();
}

/** Per confrontare i nomi: minuscole, senza accenti, uno spazio solo. */
function normNome(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/** Le clienti che si chiamano esattamente così, in qualunque ordine. */
function clientsByName(nome, cognome) {
  const parole = normNome(`${nome} ${cognome}`).split(' ').filter(Boolean).sort().join(' ');
  if (!parole.includes(' ')) return [];          // un nome solo non basta a dire "è lei"
  return db.clients.filter(c =>
    normNome(clientFullName(c)).split(' ').sort().join(' ') === parole);
}

/**
 * Riconosce la cliente e lo dice, senza chiedere niente.
 *
 * Prima dal numero: è quello che lega l'appuntamento alla scheda.
 * Poi dal nome, che prima non contava: scrivendo "Giulia Rossi" con
 * un numero diverso da quello in scheda (o nessun numero) l'app
 * diceva "cliente nuova" e al salvataggio creava un doppione. Adesso
 * lo dice, e un tocco riprende la scheda giusta.
 */
function updateClientHint() {
  const hint = $('#clientHint');
  const tel = $('#fTelefono').value;
  const nome = $('#fNome').value;
  const cognome = $('#fCognome').value;

  /* La cliente scelta dall'elenco vale finché il nome resta il suo. */
  const scelta = db.clients.find(c => c.id === formAppt.dataset.clientId);
  if (scelta && normNome(clientFullName(scelta)) !== normNome(`${nome} ${cognome}`)) {
    delete formAppt.dataset.clientId;
  }

  const found = (formAppt.dataset.clientId && scelta) || findClient({ nome, cognome, telefono: tel });

  /* In modifica la cliente è già decisa: si dice solo chi è. */
  const inModifica = !!$('#apptId').value;

  if (found) {
    hint.hidden = false;
    hint.classList.remove('hintline--quiet', 'hintline--warn');
    hint.textContent = `Già in anagrafica, ${clientFullName(found)}`;
    return;
  }

  const omonime = inModifica ? [] : clientsByName($('#fNome').value, $('#fCognome').value);
  if (omonime.length) {
    const c = omonime[0];
    hint.hidden = false;
    hint.classList.remove('hintline--quiet');
    hint.classList.add('hintline--warn');
    hint.innerHTML =
      `${esc(clientFullName(c))} è già in anagrafica` +
      (c.telefono ? `, col numero ${esc(c.telefono)}` : '') + '. ' +
      `<button class="hintline__act" type="button" data-usa="${esc(c.id)}">Usa la sua scheda</button>`;
    return;
  }

  /* Cliente nuova: niente da dire, la scheda si crea da sola. */
  hint.hidden = true;
}

$('#clientHint').addEventListener('click', event => {
  const btn = event.target.closest('[data-usa]');
  if (!btn) return;
  const c = db.clients.find(x => x.id === btn.dataset.usa);
  if (c) scegliCliente(c);
});

/** Aggancia il form a una scheda precisa: nome, cognome e numero dalla scheda. */
function scegliCliente(c) {
  $('#fNome').value = c.nome || '';
  $('#fCognome').value = c.cognome || '';
  $('#fTelefono').value = c.telefono || '';
  formAppt.dataset.clientId = c.id;
  hideSuggest();
  updateClientHint();
}

/* Scegliere il servizio riempie durata e prezzo con quelli del listino:
   il menu dice solo il nome, i numeri si leggono nelle due caselle qui
   sotto, dove restano correggibili per le eccezioni. */
$('#fServizio').addEventListener('change', () => {
  const s = getService($('#fServizio').value);
  renderDurate(s.durata);
  /* Il nuovo principale esce dalle aggiuntive, se c'era. */
  renderAggiuntivi(leggiAggiuntivi());
  $('#fPrezzo').value = prezzoDaListino();
  /* Cambiando servizio cambia la durata, quindi anche gli orari in cui
     ci sta: la griglia e le sovrapposizioni vanno ricalcolate. */
  aggiornaOrari();
});
$('#fOra').addEventListener('input', () => { renderSlots(); renderApptHint(); });
$('#fDurata').addEventListener('change', aggiornaOrari);
$('#fData').addEventListener('change', aggiornaOrari);
$('#fTelefono').addEventListener('input', updateClientHint);
$('#fNome').addEventListener('input', updateClientHint);
$('#fCognome').addEventListener('input', updateClientHint);

/*
  RICONOSCIMENTO DELLA CLIENTE
  Mentre scrivi il nome, l'app cerca in anagrafica e propone chi
  corrisponde. Toccando un nome si riempie tutta la scheda — cognome,
  telefono, e da lì l'appuntamento resta agganciato al profilo giusto.
  Non indovina mai da sola: due Giulia diverse esistono, e riempire il
  telefono sbagliato manderebbe la conferma alla persona sbagliata.
*/
const suggestBox = $('#clientSuggest');

function renderSuggest() {
  const q = normNome($('#fNome').value);
  /* Solo in inserimento: in modifica la cliente è già decisa. */
  if (!q || $('#apptId').value) { hideSuggest(); return; }

  /* Ogni parola scritta deve stare nel nome, in qualunque ordine:
     "rossi giulia", "Giulia  Rossi" e "giulia r" trovano tutte lei. */
  const parole = q.split(' ');
  const trovate = db.clients
    .filter(c => {
      const nome = normNome(clientFullName(c));
      return parole.every(p => nome.includes(p));
    })
    .slice(0, 5);

  /* Se l'unica corrispondenza è già quella scritta per intero, il
     suggerimento non aggiunge niente. */
  if (!trovate.length ||
      (trovate.length === 1 && normNome(clientFullName(trovate[0])) === q &&
       $('#fTelefono').value.trim())) {
    hideSuggest();
    return;
  }

  suggestBox.innerHTML = trovate.map(c => {
    return `<li role="option">
      <button type="button" data-pick="${c.id}">
        <span class="avatar avatar--sm" aria-hidden="true">${esc(initials(c))}</span>
        <span class="suggest__txt">
          <b>${esc(clientFullName(c))}</b>
          <span>${esc(c.telefono || '')}</span>
        </span>
      </button>
    </li>`;
  }).join('');

  suggestBox.hidden = false;
  $('#fNome').setAttribute('aria-expanded', 'true');
}

function hideSuggest() {
  suggestBox.hidden = true;
  suggestBox.innerHTML = '';
  $('#fNome').setAttribute('aria-expanded', 'false');
}

$('#fNome').addEventListener('input', renderSuggest);
$('#fNome').addEventListener('focus', renderSuggest);

suggestBox.addEventListener('click', event => {
  const btn = event.target.closest('[data-pick]');
  if (!btn) return;
  const c = db.clients.find(x => x.id === btn.dataset.pick);
  if (c) scegliCliente(c);
});

/* Un tocco fuori chiude l'elenco senza scegliere niente. */
document.addEventListener('click', event => {
  if (!suggestBox.hidden && !event.target.closest('.suggestwrap')) hideSuggest();
});

/** Apre il pannello pronto per un nuovo inserimento. */
function openApptForm(dateKey = state.selected, prefill = null, oraIniziale = '') {
  formAppt.reset();
  delete formAppt.dataset.clientId;
  $('#apptId').value = '';
  $('#apptTitle').textContent = 'Nuovo appuntamento';
  $('#apptSubmit').textContent = 'Salva appuntamento';
  $('#clientHint').hidden = true;

  /* Nel passato non si prenota: aperto da un giorno già andato, il
     form parte da oggi. */
  const oggi = toKey(new Date());
  $('#fData').value = dateKey < oggi ? oggi : dateKey;
  $('#fData').min = oggi;
  hideSuggest();

  const s = getService($('#fServizio').value);
  renderDurate(s.durata);
  renderAggiuntivi([]);
  $('#fPrezzo').value = s.prezzo;

  /* Senza un'ora data si propone il primo orario libero della
     giornata: nel caso normale non c'è altro da scegliere. */
  mostraOraManuale(false);
  $('#fOra').value = oraIniziale || primoSlotLibero($('#fData').value, Number($('#fDurata').value),
    { eccezione: ritoccoVeloce() });

  if (prefill) {
    if (prefill.id) scegliCliente(prefill);
    else {
      $('#fNome').value = prefill.nome || '';
      $('#fCognome').value = prefill.cognome || '';
      $('#fTelefono').value = prefill.telefono || '';
      updateClientHint();
    }
  }

  openSheet('sheetAppt');
  renderSlots();
  renderApptHint();
}

/** Carica un appuntamento esistente nel pannello, in modifica. */
function editAppointment(id) {
  const a = db.appointments.find(x => x.id === id);
  if (!a) return;

  formAppt.reset();
  delete formAppt.dataset.clientId;
  $('#apptId').value = a.id;
  $('#apptTitle').textContent = 'Modifica appuntamento';
  $('#apptSubmit').textContent = 'Aggiorna appuntamento';
  /* In modifica un appuntamento già passato si può correggere. */
  $('#fData').removeAttribute('min');

  $('#fNome').value = a.nome || '';
  $('#fCognome').value = a.cognome || '';
  $('#fTelefono').value = a.telefono || '';
  /* L'appuntamento resta agganciato alla sua scheda, anche senza numero. */
  if (db.clients.some(c => c.id === a.clientId)) formAppt.dataset.clientId = a.clientId;

  /* Se il servizio è stato spento dopo la prenotazione non è più fra le
     opzioni: lo reinserisco, altrimenti la modifica lo cambierebbe. */
  $('#fServizio').value = a.serviceId;
  if ($('#fServizio').value !== a.serviceId) {
    const s = db.services.find(x => x.id === a.serviceId);
    $('#fServizio').insertAdjacentHTML('afterbegin',
      `<option value="${esc(a.serviceId)}">${esc(s ? s.nome : a.servizio)} (non più in uso)</option>`);
    $('#fServizio').value = a.serviceId;
  }
  renderAggiuntivi(a.aggiuntivi || []);

  $('#fData').value = a.data;
  $('#fOra').value = a.ora;
  mostraOraManuale(false);
  renderDurate(a.durata);
  $('#fPrezzo').value = a.prezzo;
  $('#fNote').value = a.note || '';

  updateClientHint();
  closeSheet('sheetApptView');
  openSheet('sheetAppt');
  renderSlots();
  renderApptHint();
}

$('#homeNew').addEventListener('click', () => openApptForm(toKey(new Date())));
$('#agendaNew').addEventListener('click', () => openApptForm(state.selected));

formAppt.addEventListener('submit', event => {
  event.preventDefault();

  /* Lo stato non si decide da qui: l'appuntamento si prende mentre si
     parla con la cliente, e in quel momento il lavoro è per forza
     ancora da fare. Si segna completato dal suo dettaglio, dopo. In
     modifica resta quello che era, altrimenti ritoccare l'ora di un
     lavoro già fatto lo rimetterebbe fra quelli da fare. */
  const precedente = db.appointments.find(a => a.id === $('#apptId').value);

  const payload = {
    id: $('#apptId').value || null,
    clientId: formAppt.dataset.clientId || null,
    nome: $('#fNome').value.trim(),
    cognome: $('#fCognome').value.trim(),
    telefono: $('#fTelefono').value.trim(),
    serviceId: $('#fServizio').value,
    aggiuntivi: leggiAggiuntivi(),
    data: $('#fData').value,
    ora: $('#fOra').value,
    durata: Number($('#fDurata').value),
    prezzo: Number($('#fPrezzo').value),
    stato: precedente ? precedente.stato : 'wait',
    note: $('#fNote').value.trim(),
    createdAt: precedente ? precedente.createdAt : null
  };

  /* Il telefono è facoltativo: senza, la scheda si riconosce dal nome. */
  const missing = [];
  if (!payload.nome) missing.push(['nome', '#fNome']);
  /* Il cognome serve a non confondere due clienti con lo stesso nome.
     Non si chiede per una cliente scelta dall'elenco: la scheda giusta
     è già decisa, anche se è una scheda vecchia senza cognome. */
  if (!payload.cognome && !payload.clientId) missing.push(['cognome', '#fCognome']);
  if (!payload.data) missing.push(['data', '#fData']);
  if (!payload.ora) missing.push(['orario', '#fOra']);
  if (!payload.durata || payload.durata < 5) missing.push(['durata', '#fDurata']);
  if (missing.length) {
    segnalaCampi(missing.map(m => m[1]));
    /* L'orario si sceglie dai quadratini: è lì che va l'occhio. */
    if (!payload.ora) {
      $('#fOra').closest('.slotfield').classList.add('is-invalid');
      $('#slotGrid').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    toast('Manca ancora ' + missing.map(m => m[0]).join(', ') + '.', 'error', 5000);
    return;
  }

  /* CONTROLLO SOVRAPPOSIZIONI: avvisa, non impedisce. */
  const conflicts = findConflicts(payload, payload.id);
  if (conflicts.length) { askConflict(conflicts, () => finalizeSave(payload)); return; }
  finalizeSave(payload);
});

function finalizeSave(payload) {
  const isNew = !payload.id;
  const saved = commitAppointment(payload);

  state.selected = saved.data;
  state.month = startOfMonth(fromKey(saved.data));

  /* Si resta dove si era: il messaggio qui sotto dice già giorno e
     ora, e l'Agenda è comunque già posizionata su quel giorno. Prima
     si veniva portati in Agenda anche partendo dalla Home. */
  closeSheet('sheetAppt');
  renderAll();

  toast(
    `Appuntamento ${isNew ? 'salvato' : 'aggiornato'} per ${clientLabel(saved)}, ` +
    `${fmtDayShort.format(fromKey(saved.data))} alle ${saved.ora}.`, 'ok', 4000
  );
}

/**
 * AVVISO DI SOVRAPPOSIZIONE — non bloccante.
 * Elenca i conflitti e lascia decidere: capita di prendere due clienti
 * insieme apposta, e un blocco costringerebbe a inventare orari falsi.
 */
function askConflict(conflicts, onForce) {
  state.pendingSave = onForce;

  $('#conflictIntro').textContent = conflicts.length === 1
    ? "L'orario scelto si sovrappone a un altro appuntamento:"
    : `L'orario scelto si sovrappone a ${conflicts.length} appuntamenti:`;

  $('#conflictList').innerHTML = conflicts.map(a => `
    <li><b>${esc(a.ora)} – ${endTime(a)}</b> · ${esc(clientLabel(a))} — ${esc(a.servizio)}</li>`).join('');

  openSheet('sheetConflict');
  /* Il pulsante distruttivo non deve essere quello a fuoco per sbaglio. */
  setTimeout(() => $('#conflictForce').blur(), 80);
}

$('#conflictForce').addEventListener('click', () => {
  const action = state.pendingSave;
  state.pendingSave = null;
  closeSheet('sheetConflict');
  if (typeof action === 'function') action();
  toast('Salvato con una sovrapposizione, controlla la giornata.', 'warn', 5000);
});

/* --- Dettaglio appuntamento ------------------------------ */
function fillApptView(id) {
  const a = db.appointments.find(x => x.id === id);
  if (!a) { closeSheet('sheetApptView'); return; }

  state.viewApptId = id;
  $('#avName').textContent = clientLabel(a);
  $('#avTime').textContent = `${a.ora} → ${endTime(a)}`;
  $('#avDate').textContent = `${fmtDayLong.format(fromKey(a.data))} · ${a.durata} min`;
  $('#avService').textContent = a.servizio;
  $('#avPrice').textContent = fmtEuro(a.prezzo);
  /* Senza numero non si chiama e non si scrive: i due pulsanti spariscono
     invece di rispondere "numero non valido". */
  const haNumero = !!normPhone(a.telefono);
  $('#avPhone').textContent = a.telefono || '';
  $('#avPhone').closest('li').hidden = !haNumero;
  $('#avCallBtn').hidden = !haNumero;

  /* L'indirizzo e il pulsante Mappa compaiono solo se la scheda della
     cliente ne ha uno: servono alle visite a domicilio. */
  const indirizzo = apptAddress(a);
  $('#avAddrRow').hidden = !indirizzo;
  $('#avAddr').textContent = indirizzo;
  $('#avMapBtn').hidden = !indirizzo;

  $('#avNote').hidden = !a.note;
  $('#avNote').textContent = a.note || '';

  const cliente = db.clients.find(x => x.id === a.clientId);
  const notaFissa = cliente ? String(cliente.note || '').trim() : '';
  $('#avClientNote').hidden = !notaFissa;
  $('#avClientNote').textContent = notaFissa ? 'Dalla scheda: ' + notaFissa : '';

  /* Una riga di pulsanti tutti nascosti lascerebbe un vuoto. */
  $('#avActRow').hidden = $$('#avActRow .btn').every(b => b.hidden);

  const conflicts = findConflicts(a, a.id);
  $('#avConflict').hidden = !conflicts.length;
  if (conflicts.length) {
    $('#avConflict').textContent = 'Si sovrappone a ' +
      conflicts.map(c => `${c.ora} ${clientLabel(c)}`).join(' · ');
  }

  /* L'interruttore è l'unica cosa da fare su un appuntamento passato. */
  $('#avDone').checked = a.stato === 'done';
}

function openApptView(id) {
  fillApptView(id);
  openSheet('sheetApptView');
}

$('#avDone').addEventListener('change', event => {
  if (state.viewApptId) setStato(state.viewApptId, event.target.checked ? 'done' : 'wait');
});

$('#sheetApptView').addEventListener('click', event => {
  const btn = event.target.closest('[data-avact]');
  if (!btn || !state.viewApptId) return;
  const id = state.viewApptId;
  const appt = db.appointments.find(a => a.id === id);
  if (!appt) return;

  switch (btn.dataset.avact) {
    case 'call': chiama(appt.telefono); break;
    case 'map':  apriMappa(apptAddress(appt)); break;
    case 'edit': editAppointment(id); break;
    case 'del':  deleteAppointment(id); break;
  }
});

/* Le righe degli elenchi aprono il dettaglio: un solo gestore per
   Home (da segnare e prossimi) e Agenda. */
[$('#homePending'), $('#homeUpcoming'), $('#dayList')].forEach(elenco =>
  elenco.addEventListener('click', event => {
    const fatto = event.target.closest('[data-done]');
    if (fatto) { setStato(fatto.dataset.done, 'done'); return; }
    if (event.target.closest('[data-pending-all]')) { pendingTutti = true; renderHome(); return; }
    const btn = event.target.closest('[data-appt]');
    if (btn) openApptView(btn.dataset.appt);
  })
);

/* Le righe "da segnare" non sono pulsanti veri (dentro c'è la spunta):
   da tastiera si aprono con Invio o spazio, come un pulsante. */
$('#homePending').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const riga = event.target.closest('div[data-appt]');
  if (!riga || event.target !== riga) return;
  event.preventDefault();
  openApptView(riga.dataset.appt);
});


/* --- Calendario: comandi --------------------------------- */
$('#prevPeriod').addEventListener('click', () => movePeriod(-1));
$('#nextPeriod').addEventListener('click', () => movePeriod(1));

function movePeriod(dir) {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + dir, 1);
  renderCalendar();
}

/* --- Esportazione nel calendario del telefono ------------ */
/* Ci si arriva da due parti: dall'Agenda, col pulsante in alto, e da
   Backup, dov'è l'unico file che l'app lascia uscire. */
function apriEsportaCalendario() {
  const giorno = fromKey(state.selected);
  const lunedi = startOfWeek(giorno);
  const domenica = addDays(lunedi, 6);

  /* Le etichette dicono quale periodo verrà esportato davvero, invece
     di un generico "settimana" che lascia indovinare quale. */
  $('#icsDayLabel').textContent = state.selected === toKey(new Date())
    ? 'Oggi' : capitalize(fmtDayLong.format(giorno));
  $('#icsWeekLabel').textContent =
    `Settimana ${fmtDayMini.format(lunedi)} – ${fmtDayMini.format(domenica)}`;
  $('#icsMonthLabel').textContent = capitalize(fmtMonth.format(giorno));

  openSheet('sheetExport');
}

$('#btnExportIcs').addEventListener('click', apriEsportaCalendario);
$('#sheetExport').addEventListener('click', event => {
  const btn = event.target.closest('[data-ics]');
  if (!btn) return;

  const giorno = fromKey(state.selected);
  const oggi = toKey(new Date());
  let list, filename, nome;

  switch (btn.dataset.ics) {
    case 'day':
      list = apptsByDay(state.selected);
      filename = `agenda-${state.selected}.ics`;
      nome = `Agenda ${fmtDayShort.format(giorno)}`;
      break;
    case 'week': {
      const lunedi = startOfWeek(giorno);
      list = apptsBetween(toKey(lunedi), toKey(addDays(lunedi, 6)));
      filename = `agenda-settimana-${toKey(lunedi)}.ics`;
      nome = `Agenda settimana del ${fmtDayShort.format(lunedi)}`;
      break;
    }
    case 'month': {
      const primo = startOfMonth(giorno);
      const ultimo = new Date(primo.getFullYear(), primo.getMonth() + 1, 0);
      list = apptsBetween(toKey(primo), toKey(ultimo));
      filename = `agenda-${toKey(primo).slice(0, 7)}.ics`;
      nome = `Agenda ${fmtMonth.format(primo)}`;
      break;
    }
    case 'future':
      list = apptsBetween(oggi, '9999-12-31');
      filename = `agenda-da-${oggi}.ics`;
      nome = 'Agenda — prossimi appuntamenti';
      break;
    default:
      return;
  }

  esportaIcs(list, filename, nome);
  closeSheet('sheetExport');
});

$('#todayBtn').addEventListener('click', () => {
  state.selected = toKey(new Date());
  state.month = startOfMonth(new Date());
  renderCalendar();
  renderDayList();
});

$('#calGrid').addEventListener('click', event => {
  const cell = event.target.closest('.day');
  if (!cell) return;
  state.selected = cell.dataset.date;
  /* Toccando un giorno di un altro mese ci si sposta su quel mese. */
  state.month = startOfMonth(fromKey(state.selected));
  renderCalendar();
  renderDayList();
});

/* --- Clienti: ricerca, ordinamento, scheda --------------- */
$('#clientSearch').addEventListener('input', event => {
  state.clientQuery = event.target.value;
  renderClients();
});

$('#clientsList').addEventListener('click', event => {
  const btn = event.target.closest('[data-client]');
  if (btn) openClientView(btn.dataset.client);
});

function openClientView(id) {
  const c = db.clients.find(x => x.id === id);
  if (!c) return;
  state.viewClientId = id;

  const stats = clientStats(id);
  $('#cvName').textContent = clientFullName(c);
  $('#cvPhone').textContent = c.telefono || '';
  $('#cvPhone').closest('li').hidden = !normPhone(c.telefono);

  const indirizzo = String(c.indirizzo || '').trim();
  $('#cvAddrRow').hidden = !indirizzo;
  $('#cvAddr').textContent = indirizzo;
  $('#cvMapBtn').hidden = !indirizzo;
  $('#cvCallBtn').hidden = !normPhone(c.telefono);
  $('#cvActRow').hidden = $$('#cvActRow .btn').every(b => b.hidden);

  $('#cvVisits').textContent = stats.trattamenti;
  $('#cvLast').textContent = stats.ultima ? fmtDayShort.format(fromKey(stats.ultima)) : '—';

  $('#cvNote').hidden = !c.note;
  $('#cvNote').textContent = c.note || '';

  /* Storico: righe uguali a quelle dei Conti — data a foglietto,
     prestazione, importo, matita e cestino. L'anno compare solo per i
     trattamenti di un altro anno: lo storico, a differenza dei Conti,
     non è diviso per mese e "nov" da solo non direbbe quale. */
  const list = clientHistory(id);
  const annoCorrente = new Date().getFullYear();
  $('#cvHistory').innerHTML = list.length
    ? list.map(a => {
      const giorno = fromKey(a.data);
      const anno = giorno.getFullYear() !== annoCorrente ? ` ${String(giorno.getFullYear()).slice(2)}` : '';
      return `<li>
        <div class="row row--static">
          <span class="row__date">
            <b>${giorno.getDate()}</b>
            <span>${MESI_BREVI[giorno.getMonth()]}${anno}</span>
          </span>
          <span class="row__main">
            <span class="row__title">${esc(a.servizio)}</span>
            ${a.stato === 'done'
              ? `<span class="row__amount row__amount--in">+${fmtEuro(a.prezzo)}</span>`
              : `<span class="row__amount">${fmtEuro(a.prezzo)} · da completare</span>`}
          </span>
          <span class="row__acts">
            <button class="rowact" type="button" data-histedit="${a.id}"
                    aria-label="Modifica ${esc(a.servizio)} del ${esc(fmtDayShort.format(giorno))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-4-4l-10 10v4Z"/><path d="m13.5 6.5 4 4"/></svg></button>
            <button class="rowact rowact--del" type="button" data-histdel="${a.id}"
                    aria-label="Elimina ${esc(a.servizio)} del ${esc(fmtDayShort.format(fromKey(a.data)))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v5.5M13.5 10.5v5.5"/></svg></button>
          </span>
        </div>
      </li>`;
    }).join('')
    : '<li class="empty">Ancora nessun trattamento.</li>';

  openSheet('sheetClientView');
}

/* La matita apre l'appuntamento in modifica. La scheda cliente si
   chiude prima: nella pagina viene dopo il modulo e lo coprirebbe.
   Il cestino chiede conferma, elimina, e lo storico si ridisegna
   restando sulla scheda. */
$('#cvHistory').addEventListener('click', async event => {
  const edit = event.target.closest('[data-histedit]');
  if (edit) {
    closeSheet('sheetClientView');
    editAppointment(edit.dataset.histedit);
    return;
  }
  const btn = event.target.closest('[data-histdel]');
  if (!btn) return;
  const cliente = state.viewClientId;
  await deleteAppointment(btn.dataset.histdel);
  if (cliente && !$('#sheetClientView').hidden) openClientView(cliente);
});

$('#sheetClientView').addEventListener('click', event => {
  const btn = event.target.closest('[data-cvact]');
  if (!btn || !state.viewClientId) return;
  const id = state.viewClientId;
  const c = db.clients.find(x => x.id === id);
  if (!c) return;

  switch (btn.dataset.cvact) {
    case 'new':
      /* Dalla scheda si prenota senza ribattere nome e telefono. */
      closeSheet('sheetClientView');
      openApptForm(toKey(new Date()), c);
      break;
    case 'call': chiama(c.telefono); break;
    case 'map':  apriMappa(c.indirizzo); break;
    case 'edit':
      closeSheet('sheetClientView');
      openClientForm(c);
      break;
    case 'del': deleteClient(id); break;
  }
});

/* --- Form cliente ---------------------------------------- */
const formClient = $('#formClient');

/**
 * Apre la scheda cliente. `prefill` arriva dal form appuntamento quando
 * la cliente è nuova: nome, cognome e telefono sono già stati scritti
 * lì e non vanno ribattuti.
 */
function openClientForm(client = null) {
  formClient.reset();
  $('#clientId').value = client ? client.id : '';
  $('#clientFormTitle').textContent = client ? 'Modifica scheda' : 'Nuova cliente';
  if (client) {
    $('#cNome').value = client.nome || '';
    $('#cCognome').value = client.cognome || '';
    $('#cTelefono').value = client.telefono || '';
    $('#cVia').value = client.via || '';
    $('#cCivico').value = client.civico || '';
    $('#cCap').value = client.cap || '';
    $('#cCitta').value = client.citta || '';
    $('#cProvincia').value = client.provincia || '';
    $('#cNote').value = client.note || '';
  }
  openSheet('sheetClient');
}

$('#clientNew').addEventListener('click', () => openClientForm());

/* La sigla della provincia si scrive maiuscola da sola, il CAP solo cifre. */
$('#cProvincia').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2);
});
$('#cCap').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
});

formClient.addEventListener('submit', event => {
  event.preventDefault();
  const id = $('#clientId').value;
  const nome = $('#cNome').value.trim();
  const cognome = $('#cCognome').value.trim();
  const telefono = $('#cTelefono').value.trim();
  const indirizzo = {
    via: capitalize($('#cVia').value),
    civico: $('#cCivico').value.trim(),
    cap: $('#cCap').value.trim(),
    citta: capitalize($('#cCitta').value),
    provincia: $('#cProvincia').value.trim().toUpperCase()
  };

  /* Nome e cognome sempre: il telefono è facoltativo, e senza numero
     è il nome intero che distingue una cliente dall'altra. */
  const mancano = [];
  if (!nome) mancano.push(['nome', '#cNome']);
  if (!cognome) mancano.push(['cognome', '#cCognome']);
  /* L'indirizzo è facoltativo, ma iniziato va finito: senza via o
     senza città la Mappa porterebbe nel posto sbagliato. */
  if (CAMPI_INDIRIZZO.some(k => indirizzo[k])) {
    if (!indirizzo.via) mancano.push(['via', '#cVia']);
    if (!indirizzo.citta) mancano.push(['città', '#cCitta']);
  }
  if (mancano.length) {
    segnalaCampi(mancano.map(m => m[1]));
    toast('Manca ancora ' + mancano.map(m => m[0]).join(', ') + '.', 'error', 5000);
    return;
  }
  if (indirizzo.cap && !/^\d{5}$/.test(indirizzo.cap)) {
    segnalaCampi(['#cCap']);
    toast('Il CAP ha 5 cifre.', 'error');
    return;
  }
  if (indirizzo.provincia && !/^[A-Z]{2}$/.test(indirizzo.provincia)) {
    segnalaCampi(['#cProvincia']);
    toast('La provincia è la sigla di 2 lettere, per esempio MI.', 'error');
    return;
  }

  if (id) {
    const c = db.clients.find(x => x.id === id);
    if (c) {
      c.nome = capitalize(nome);
      c.cognome = capitalize(cognome);
      c.telefono = telefono;
      CAMPI_INDIRIZZO.forEach(k => { c[k] = indirizzo[k]; });
      c.indirizzo = componiIndirizzo(c);
      c.note = $('#cNote').value.trim();
      c.updatedAt = new Date().toISOString();
    }
  } else {
    const duplicate = findClient({ nome, cognome, telefono });
    if (duplicate) toast(`${clientFullName(duplicate)} era già in anagrafica: ho aggiornato la sua scheda.`, 'warn', 4500);
    upsertClient({
      nome,
      cognome,
      telefono,
      indirizzo,
      note: $('#cNote').value.trim()
    });
  }

  /* Nome, cognome e numero corretti qui valgono anche per gli
     appuntamenti già presi. */
  allineaAppuntamenti(db);
  saveDB();
  closeSheet('sheetClient');
  renderAll();
  toast('Scheda salvata.', 'ok');
});

/* --- Spese ----------------------------------------------- */
const formExpense = $('#formExpense');

/**
 * Il menu Negozio: i negozi di Impostazioni → Negozi, più quello della
 * spesa che si sta modificando se nel frattempo è uscito dall'elenco
 * (altrimenti la modifica lo cancellerebbe).
 */
function renderNegoziMenu(extra = '') {
  const sel = $('#eFornitore');
  const scelto = extra || sel.value;
  const nomi = [...db.settings.negozi];
  if (extra && !nomi.some(n => n.toLowerCase() === extra.toLowerCase())) nomi.push(extra);
  sel.innerHTML = '<option value="">Scegli il negozio</option>' +
    nomi.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  sel.value = nomi.includes(scelto) ? scelto : '';
}

/**
 * Suggerimenti sotto "Cosa hai comprato": quelli della categoria e
 * quelli già scritti altre volte in quella categoria, i più usati per
 * primi. Scrivendo, restano solo quelli che contengono le lettere
 * scritte; quello già uguale al campo sparisce.
 */
/**
 * Riempie un contenitore di "chip" sotto un campo descrizione: i
 * suggerimenti fissi della categoria scelta più quelli già scritti
 * altre volte in quella categoria, i più usati per primi. Scrivendo,
 * restano solo quelli che contengono le lettere scritte.
 */
function renderSuggerimenti(selCat, selDesc, contenitore, records) {
  const cat = selCat.value || '';
  const scritto = normNome(selDesc.value);
  const uso = new Map();
  records.filter(r => r.categoria === cat && r.descrizione).forEach(r => {
    const d = String(r.descrizione).trim();
    uso.set(d, (uso.get(d) || 0) + 1);
  });
  const giaUsati = [...uso.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
  const visti = new Set();
  const voci = [...giaUsati, ...(SUGGERIMENTI[cat] || [])].filter(v => {
    const k = normNome(v);
    if (visti.has(k) || k === scritto) return false;
    visti.add(k);
    return !scritto || k.includes(scritto);
  }).slice(0, 8);
  contenitore.innerHTML = voci
    .map(v => `<button type="button" class="chip" data-chip="${esc(v)}">${esc(v)}</button>`).join('');
}

function renderSuggerimentiSpesa() {
  renderSuggerimenti($('#eCategoria'), $('#eDescrizione'), $('#eSuggest'), db.expenses);
}
function renderSuggerimentiGuadagno() {
  renderSuggerimenti($('#iCategoria'), $('#iDescrizione'), $('#iSuggest'), db.incomes);
}

$('#eSuggest').addEventListener('click', event => {
  const chip = event.target.closest('[data-chip]');
  if (!chip) return;
  $('#eDescrizione').value = chip.dataset.chip;
  $('#eDescrizione').closest('.field').classList.remove('is-invalid');
  renderSuggerimentiSpesa();
});
$('#eDescrizione').addEventListener('input', renderSuggerimentiSpesa);
$('#eCategoria').addEventListener('change', renderSuggerimentiSpesa);
$('#eNegoziGestisci').addEventListener('click', () => { renderNegozi(); openSheet('sheetNegozi'); });
$('#eCatGestisci').addEventListener('click', () => { renderCatSpese(); openSheet('sheetCatSpese'); });

$('#iSuggest').addEventListener('click', event => {
  const chip = event.target.closest('[data-chip]');
  if (!chip) return;
  $('#iDescrizione').value = chip.dataset.chip;
  renderSuggerimentiGuadagno();
});
$('#iDescrizione').addEventListener('input', renderSuggerimentiGuadagno);
$('#iCategoria').addEventListener('change', renderSuggerimentiGuadagno);
$('#iCatGestisci').addEventListener('click', () => { renderCatEntrate(); openSheet('sheetCatEntrate'); });
$('#iMetodiGestisci').addEventListener('click', () => { renderMetodi(); openSheet('sheetMetodi'); });
$('#payMetodiGestisci').addEventListener('click', () => { renderMetodi(); openSheet('sheetMetodi'); });
$('#payOk').addEventListener('click', () => pagamentoClose($('#payMetodo').value));
$('#payNo').addEventListener('click', () => pagamentoClose(null));

function openExpenseForm(expense = null) {
  formExpense.reset();
  $('#expenseId').value = expense ? expense.id : '';
  $('#expenseTitle').textContent = expense ? 'Modifica spesa' : 'Nuova spesa';
  $('#expenseSubmit').textContent = expense ? 'Aggiorna spesa' : 'Salva spesa';

  if (expense) {
    $('#eData').value = expense.data;
    $('#eImporto').value = expense.importo;
    riempiSelect($('#eCategoria'), db.settings.categorieSpese, expense.categoria);
    $('#eDescrizione').value = expense.descrizione;
    renderNegoziMenu(expense.fornitore || '');
  } else {
    /* La data è quella di oggi: si cambia solo se la spesa è di un
       altro giorno. */
    $('#eData').value = toKey(new Date());
    riempiSelect($('#eCategoria'), db.settings.categorieSpese, '');
    renderNegoziMenu();
    $('#eFornitore').value = '';
  }
  renderSuggerimentiSpesa();
  openSheet('sheetExpense');
}

$('#expenseNew').addEventListener('click', () => openExpenseForm());

/* I due riquadri della pagina Conti aprono il loro elenco. */
$('#openIncomes').addEventListener('click', () => { renderIncomes(); openSheet('sheetIncomes'); });
$('#openExpenses').addEventListener('click', () => { renderExpenses(); openSheet('sheetExpenses'); });

/* Il + in cima a Conti: si sceglie che cosa, e si apre il modulo giusto. */
$('#contiAdd').addEventListener('click', () => openSheet('sheetAddChoice'));
$('#sheetAddChoice').addEventListener('click', event => {
  const btn = event.target.closest('[data-add]');
  if (!btn) return;
  closeSheet('sheetAddChoice');
  if (btn.dataset.add === 'income') openIncomeForm();
  else openExpenseForm();
});

/* --- Dettaglio spesa -------------------------------------
   Toccando una riga si apre la scheda, non il modulo: si legge
   quello che si e' speso, e da li' si decide se modificare o
   eliminare. E' la stessa strada degli appuntamenti e delle
   clienti — un solo modo di aprire le cose, in tutta l'app. */
function fillExpenseView(id) {
  const e = db.expenses.find(x => x.id === id);
  if (!e) { closeSheet('sheetExpenseView'); return; }

  state.viewExpenseId = id;
  const giorno = fromKey(e.data);
  $('#evTitle').textContent = e.descrizione;
  $('#evAmount').textContent = fmtEuro(e.importo);
  $('#evDate').textContent = fmtDayLong.format(giorno);
  $('#evCategory').textContent = e.categoria || 'Altro';

  /* Il fornitore e' facoltativo: senza, la riga sparisce invece di
     restare li' con un trattino. */
  $('#evSupplierRow').hidden = !e.fornitore;
  $('#evSupplier').textContent = e.fornitore || '';

  const chiaveMese = String(e.data).slice(0, 7);
  const totMese = db.expenses
    .filter(x => String(x.data).startsWith(chiaveMese))
    .reduce((s, x) => s + Number(x.importo || 0), 0);
  $('#evMonth').textContent =
    `${fmtEuro(totMese)} · ${capitalize(fmtMonth.format(giorno))}`;
}

function openExpenseView(id) {
  fillExpenseView(id);
  openSheet('sheetExpenseView');
}

$('#expensesList').addEventListener('click', azioneConto);

$('#sheetExpenseView').addEventListener('click', event => {
  const btn = event.target.closest('[data-evact]');
  if (!btn || !state.viewExpenseId) return;
  const id = state.viewExpenseId;
  const exp = db.expenses.find(e => e.id === id);
  if (!exp) return;

  if (btn.dataset.evact === 'edit') {
    /* Una sola cosa aperta alla volta: la scheda si chiude e al suo
       posto sale il modulo, gia' compilato. */
    closeSheet('sheetExpenseView');
    openExpenseForm(exp);
  } else if (btn.dataset.evact === 'del') {
    deleteExpense(id);
  }
});

$('#expenseMonth').addEventListener('change', event => {
  state.expenseMonth = event.target.value;
  renderExpenses();
});

$('#balanceYear').addEventListener('change', event => {
  state.year = Number(event.target.value);
  renderConti();
  renderIncomes();
  renderExpenses();
});

/* --- Guadagni -------------------------------------------- */
const formIncome = $('#formIncome');

function openIncomeForm(income = null) {
  formIncome.reset();
  $('#incomeId').value = income ? income.id : '';
  $('#incomeTitle').textContent = income ? 'Modifica guadagno' : 'Nuovo guadagno';
  $('#incomeSubmit').textContent = income ? 'Aggiorna guadagno' : 'Salva guadagno';

  /* Il guadagno di un appuntamento ha la data dell'appuntamento: qui si
     vede ma non si cambia (si cambia spostando l'appuntamento). */
  const appt = income && income.appuntamentoId
    ? db.appointments.find(a => a.id === income.appuntamentoId) : null;
  /* Si nasconde tutto il campo data, compreso il pulsante col
     calendario che l'app mette al suo posto (abbellisciData), e al
     suo posto si legge la data fissa, nello stesso formato. */
  $('#iData').closest('.field').classList.toggle('is-fixed', !!appt);
  $('#iDataFissa').hidden = !appt;
  if (appt) $('#iDataFissa').textContent = etichettaData(appt.data);
  $('#incomeLinkHint').hidden = !appt;
  if (appt) {
    $('#incomeLinkHint').textContent =
      `Guadagno dell'appuntamento di ${etichettaData(appt.data).toLowerCase()}: la data è quella ` +
      `dell'appuntamento, e l'importo cambia anche il suo prezzo.`;
  }

  if (income) {
    $('#iData').value = income.data;
    $('#iImporto').value = income.importo;
    riempiSelect($('#iCategoria'), db.settings.categorieEntrate, income.categoria);
    $('#iDescrizione').value = income.descrizione || '';
    $('#iCliente').value = income.cliente || '';
    riempiMetodi($('#iMetodo'), income.metodo || '');
  } else {
    $('#iData').value = toKey(new Date());
    riempiSelect($('#iCategoria'), db.settings.categorieEntrate, '');
    riempiMetodi($('#iMetodo'), db.settings.metodiPagamento[0] || '');
  }
  renderSuggerimentiGuadagno();
  openSheet('sheetIncome');
}

$('#incomeNew').addEventListener('click', () => openIncomeForm());

function fillIncomeView(id) {
  const i = db.incomes.find(x => x.id === id);
  if (!i) { closeSheet('sheetIncomeView'); return; }

  state.viewIncomeId = id;
  const giorno = fromKey(i.data);
  $('#ivTitle').textContent = incomeTitle(i);
  $('#ivAmount').textContent = '+' + fmtEuro(i.importo);
  $('#ivDate').textContent = fmtDayLong.format(giorno);
  $('#ivCategory').textContent = i.categoria || 'Altro';
  $('#ivFromRow').hidden = !i.cliente;
  $('#ivFrom').textContent = i.cliente || '';
  $('#ivMethod').textContent = i.metodo || 'Non indicato';

  /* Tutto quello che è entrato nel mese, trattamenti compresi. */
  const d = giorno;
  $('#ivMonth').textContent =
    `${fmtEuro(monthTotals(d.getFullYear(), d.getMonth()).incassi)} · ${capitalize(fmtMonth.format(giorno))}`;
}

function openIncomeView(id) {
  fillIncomeView(id);
  openSheet('sheetIncomeView');
}

/* Una riga dell'elenco: matita e cestino lavorano sul guadagno, anche
   quando è nato da un appuntamento completato. */
$('#incomesList').addEventListener('click', azioneConto);

$('#sheetIncomeView').addEventListener('click', event => {
  const btn = event.target.closest('[data-ivact]');
  if (!btn || !state.viewIncomeId) return;
  const id = state.viewIncomeId;
  const inc = db.incomes.find(i => i.id === id);
  if (!inc) return;

  if (btn.dataset.ivact === 'edit') {
    closeSheet('sheetIncomeView');
    openIncomeForm(inc);
  } else if (btn.dataset.ivact === 'del') {
    deleteIncome(id);
  }
});

$('#incomeMonth').addEventListener('change', event => {
  state.incomeMonth = event.target.value;
  renderIncomes();
});

formIncome.addEventListener('submit', event => {
  event.preventDefault();
  const payload = {
    id: $('#incomeId').value || null,
    data: $('#iData').value,
    importo: Number($('#iImporto').value),
    categoria: $('#iCategoria').value,
    descrizione: $('#iDescrizione').value.trim(),
    cliente: $('#iCliente').value.trim(),
    metodo: $('#iMetodo').value
  };
  if (payload.id) {
    const prima = db.incomes.find(i => i.id === payload.id);
    if (prima) payload.createdAt = prima.createdAt;
  }

  if (!payload.data || !(payload.importo > 0)) {
    segnalaCampi([!payload.data && '#iData', !(payload.importo > 0) && '#iImporto'].filter(Boolean));
    toast('Servono la data e un importo maggiore di zero.', 'error');
    return;
  }

  const isNew = !payload.id;
  const saved = commitIncome(payload);
  /* L'anno e il mese dell'elenco seguono il guadagno appena scritto,
     altrimenti sparirebbe subito dopo averlo salvato. */
  state.year = Number(saved.data.slice(0, 4));
  if (state.incomeMonth !== 'all') state.incomeMonth = saved.data.slice(0, 7);
  closeSheet('sheetIncome');
  renderAll();
  toast(isNew ? 'Guadagno registrato.' : 'Guadagno aggiornato.', 'ok');
});

formExpense.addEventListener('submit', event => {
  event.preventDefault();
  const payload = {
    id: $('#expenseId').value || null,
    data: $('#eData').value,
    importo: Number($('#eImporto').value),
    categoria: $('#eCategoria').value,
    descrizione: $('#eDescrizione').value.trim(),
    fornitore: $('#eFornitore').value.trim()
  };
  if (payload.id) {
    const prima = db.expenses.find(e => e.id === payload.id);
    if (prima) payload.createdAt = prima.createdAt;
  }
  /* La data non si chiede: se è stata tolta, vale oggi. */
  if (!payload.data) payload.data = toKey(new Date());

  const mancano = [];
  if (!(payload.importo > 0)) mancano.push(['importo', '#eImporto']);
  if (!payload.descrizione) mancano.push(['cosa hai comprato', '#eDescrizione']);
  if (!payload.fornitore) mancano.push(['negozio', '#eFornitore']);
  if (mancano.length) {
    segnalaCampi(mancano.map(m => m[1]));
    toast('Manca ancora ' + mancano.map(m => m[0]).join(', ') + '.', 'error', 5000);
    return;
  }

  const isNew = !payload.id;
  const saved = commitExpense(payload);
  /* Il filtro salta al mese della spesa appena scritta, altrimenti
     sparirebbe dall'elenco subito dopo averla salvata. */
  state.year = Number(saved.data.slice(0, 4));
  if (state.expenseMonth !== 'all') state.expenseMonth = saved.data.slice(0, 7);
  closeSheet('sheetExpense');
  renderAll();
  toast(isNew ? 'Spesa registrata.' : 'Spesa aggiornata.', 'ok');
});

/* --- Listino --------------------------------------------- */
/** Le voci iniziali non si eliminano, si spengono: mergeServices() le rimetterebbe. */
const isServizioIniziale = id => DEFAULT_SERVICES.some(d => d.id === id);

function serviceRowHtml(s, nuovo = false) {
  const eliminabile = nuovo || !isServizioIniziale(s.id);
  return `
    <li class="srv${s.attivo ? '' : ' is-off'}" data-service="${esc(s.id)}"${nuovo ? ' data-new="1"' : ''}>
      <input class="srv__name" type="text" value="${esc(s.nome)}" data-field="nome" maxlength="120"
             autocapitalize="sentences" aria-label="Nome del servizio">
      <label class="switch">
        <input type="checkbox" data-field="attivo"${s.attivo ? ' checked' : ''}
               aria-label="${esc(s.nome)} fra i servizi in uso">
        <span class="switch__track"></span>
      </label>
      <span class="srv__fields">
        <label><span>Durata (min)</span>
          <input type="number" min="5" max="480" step="5" value="${s.durata}" data-field="durata"
                 inputmode="numeric" aria-label="Durata di ${esc(s.nome)}">
        </label>
        <label><span>Prezzo (€)</span>
          <input type="number" min="0" step="0.5" value="${s.prezzo}" data-field="prezzo"
                 inputmode="decimal" aria-label="Prezzo di ${esc(s.nome)}">
        </label>
      </span>
      ${eliminabile ? `<button class="linkbtn srv__del" type="button" data-srvdel>Elimina servizio</button>` : ''}
    </li>`;
}

function renderServices() {
  $('#servicesList').innerHTML = db.services.map(s => serviceRowHtml(s)).join('');
}

/* --- Orari di lavoro -------------------------------------
   Un giorno per riga: interruttore (lavoro / chiuso) e la fascia
   dalle–alle. Da qui nascono gli orari liberi del form appuntamento. */
function renderOrari() {
  const orari = db.settings.orariLavoro;
  $('#orariList').innerHTML = ORDINE_GIORNI.map(g => {
    const o = orari[g];
    const aperto = FASCE.some(f => o[f.id].attivo);
    return `<li class="orario${aperto ? '' : ' is-closed'}" data-giorno="${g}">
      <span class="orario__day">${GIORNI[g]}<em class="orario__closed">Chiuso</em></span>
      ${FASCE.map(f => {
        const x = o[f.id];
        return `<div class="turno${x.attivo ? '' : ' is-off'}" data-fascia="${f.id}">
          <span class="turno__name">${f.nome}</span>
          <span class="turno__times">
            <input type="time" step="900" value="${x.da}" data-ofield="da" aria-label="${GIORNI[g]}, ${f.nome.toLowerCase()}: dalle">
            <span aria-hidden="true">–</span>
            <input type="time" step="900" value="${x.a}" data-ofield="a" aria-label="${GIORNI[g]}, ${f.nome.toLowerCase()}: alle">
          </span>
          <label class="switch">
            <input type="checkbox" data-ofield="attivo"${x.attivo ? ' checked' : ''} aria-label="${GIORNI[g]}, lavoro di ${f.nome.toLowerCase()}">
            <span class="switch__track"></span>
          </label>
        </div>`;
      }).join('')}
    </li>`;
  }).join('');
}

/* Fascia spenta sbiadita, giorno senza fasce segnato chiuso: subito,
   senza aspettare il salvataggio. */
$('#orariList').addEventListener('change', event => {
  const box = event.target.closest('[data-ofield="attivo"]');
  if (!box) return;
  box.closest('.turno').classList.toggle('is-off', !box.checked);
  const giorno = box.closest('.orario');
  giorno.classList.toggle('is-closed', !$$('[data-ofield="attivo"]', giorno).some(x => x.checked));
});

/** Legge gli orari dal pannello; null (con l'errore già segnalato) se una fascia non torna. */
function leggiOrari() {
  const out = {};
  for (const row of $$('#orariList .orario')) {
    const g = row.dataset.giorno;
    out[g] = {};
    for (const riga of $$('.turno', row)) {
      const f = riga.dataset.fascia;
      const attivo = $('[data-ofield="attivo"]', riga).checked;
      const da = $('[data-ofield="da"]', riga).value;
      const a = $('[data-ofield="a"]', riga).value;
      if (attivo && (!da || !a || toMinutes(a) <= toMinutes(da))) {
        riga.classList.add('is-invalid');
        riga.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const nome = FASCE.find(x => x.id === f).nome.toLowerCase();
        toast(`${GIORNI[g]}, ${nome}: l'orario di fine deve venire dopo quello di inizio.`, 'error', 5000);
        return null;
      }
      riga.classList.remove('is-invalid');
      out[g][f] = fascia(attivo, da || DEFAULT_ORARI[g][f].da, a || DEFAULT_ORARI[g][f].a);
    }
  }
  return out;
}

/* L'opacità segue subito l'interruttore, senza aspettare il salvataggio. */
$('#servicesList').addEventListener('change', event => {
  const box = event.target.closest('[data-field="attivo"]');
  if (box) box.closest('.srv').classList.toggle('is-off', !box.checked);
});

/* Eliminare toglie la riga: diventa vero solo con "Salva listino",
   come ogni altra modifica fatta qui. Gli appuntamenti già presi con
   quel servizio ne conservano il nome. */
$('#servicesList').addEventListener('click', event => {
  const del = event.target.closest('[data-srvdel]');
  if (del) del.closest('.srv').remove();
});

$('#servicesAdd').addEventListener('click', () => {
  const nuovo = { id: uid('srv'), nome: '', durata: 60, prezzo: 0, attivo: true };
  $('#servicesList').insertAdjacentHTML('beforeend', serviceRowHtml(nuovo, true));
  const riga = $('#servicesList .srv:last-child');
  $('[data-field="nome"]', riga).focus();
});

$('#formServices').addEventListener('submit', event => {
  event.preventDefault();
  const visti = new Set();
  const nuovi = [];

  $$('#servicesList .srv').forEach(row => {
    const nome = $('[data-field="nome"]', row).value.trim();
    const durata = Number($('[data-field="durata"]', row).value);
    const prezzo = Number($('[data-field="prezzo"]', row).value) || 0;
    const attivo = $('[data-field="attivo"]', row).checked;

    if (row.dataset.new) {
      /* Una riga aggiunta e lasciata senza nome non è un servizio. */
      if (nome) nuovi.push({ id: row.dataset.service, nome, durata: durata || 60, prezzo, attivo });
      return;
    }
    const s = db.services.find(x => x.id === row.dataset.service);
    if (!s) return;
    visti.add(s.id);
    if (nome) s.nome = nome;
    s.durata = durata || s.durata;
    s.prezzo = prezzo;
    s.attivo = attivo;
  });

  db.services = db.services.filter(s => visti.has(s.id) || isServizioIniziale(s.id)).concat(nuovi);
  saveDB();
  renderSelectOptions();
  closeSheet('sheetListino');
  toast('Listino aggiornato.', 'ok');
});

/* --- Negozi ----------------------------------------------- */
function rigaNegozio(nome = '') {
  return `<li class="negozio">
    <input type="text" value="${esc(nome)}" maxlength="160" autocapitalize="words" aria-label="Nome del negozio">
    <button class="rowact rowact--del" type="button" data-negdel aria-label="Elimina ${esc(nome || 'negozio')}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v5.5M13.5 10.5v5.5"/></svg>
    </button>
  </li>`;
}

function renderNegozi() {
  $('#negoziList').innerHTML = db.settings.negozi.map(n => rigaNegozio(n)).join('') ||
    rigaNegozio('');
}

$('#negoziAdd').addEventListener('click', () => {
  $('#negoziList').insertAdjacentHTML('beforeend', rigaNegozio(''));
  $('#negoziList .negozio:last-child input').focus();
});

/* Eliminare toglie la riga: diventa vero con "Salva negozi". Le spese
   già registrate conservano il nome del negozio. */
$('#negoziList').addEventListener('click', event => {
  const del = event.target.closest('[data-negdel]');
  if (del) del.closest('.negozio').remove();
});

$('#formNegozi').addEventListener('submit', event => {
  event.preventDefault();
  db.settings.negozi = normNegozi($$('#negoziList input').map(i => capitalize(i.value)));
  saveDB();
  renderNegoziMenu();
  closeSheet('sheetNegozi');
  toast('Negozi aggiornati.', 'ok');
});

/* --- Categorie (spese e guadagni) -------------------------
   Stesso meccanismo dei negozi: una lista di nomi che Arianna
   modifica da sola. Una categoria tolta non compare più nel menu,
   ma le spese e i guadagni già registrati tengono il loro nome. */
function rigaCategoria(nome = '') {
  return `<li class="negozio">
    <input type="text" value="${esc(nome)}" maxlength="120" autocapitalize="sentences" aria-label="Nome della categoria">
    <button class="rowact rowact--del" type="button" data-catdel aria-label="Elimina ${esc(nome || 'categoria')}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v5.5M13.5 10.5v5.5"/></svg>
    </button>
  </li>`;
}

function renderCatSpese() {
  $('#catSpeseList').innerHTML = db.settings.categorieSpese.map(rigaCategoria).join('') || rigaCategoria('');
}
function renderCatEntrate() {
  $('#catEntrateList').innerHTML = db.settings.categorieEntrate.map(rigaCategoria).join('') || rigaCategoria('');
}

/* Aggiungi e elimina riga: uguali per i due elenchi. */
/* I metodi di pagamento: stessa lista modificabile delle categorie. */
function renderMetodi() {
  $('#metodiList').innerHTML = db.settings.metodiPagamento.map(rigaCategoria).join('') || rigaCategoria('');
}

$('#formMetodi').addEventListener('submit', event => {
  event.preventDefault();
  db.settings.metodiPagamento = normNomi($$('#metodiList input').map(i => i.value.trim()));
  saveDB();
  /* I due menu aperti si aggiornano tenendo la scelta fatta. */
  riempiMetodi($('#iMetodo'), $('#iMetodo').value);
  riempiMetodi($('#payMetodo'), $('#payMetodo').value || db.settings.metodiPagamento[0] || '', false);
  closeSheet('sheetMetodi');
  toast('Metodi di pagamento aggiornati.', 'ok');
});

[['#catSpeseAdd', '#catSpeseList'], ['#catEntrateAdd', '#catEntrateList'], ['#metodiAdd', '#metodiList']].forEach(([add, list]) => {
  $(add).addEventListener('click', () => {
    $(list).insertAdjacentHTML('beforeend', rigaCategoria(''));
    $(`${list} .negozio:last-child input`).focus();
  });
  $(list).addEventListener('click', event => {
    const del = event.target.closest('[data-catdel]');
    if (del) del.closest('.negozio').remove();
  });
});

$('#formCatSpese').addEventListener('submit', event => {
  event.preventDefault();
  db.settings.categorieSpese = normNomi($$('#catSpeseList input').map(i => capitalize(i.value)));
  saveDB();
  renderSelectOptions();
  closeSheet('sheetCatSpese');
  toast('Categorie delle spese aggiornate.', 'ok');
});

$('#formCatEntrate').addEventListener('submit', event => {
  event.preventDefault();
  db.settings.categorieEntrate = normNomi($$('#catEntrateList input').map(i => capitalize(i.value)));
  saveDB();
  renderSelectOptions();
  closeSheet('sheetCatEntrate');
  toast('Categorie dei guadagni aggiornate.', 'ok');
});

$('#formOrari').addEventListener('submit', event => {
  event.preventDefault();
  const orari = leggiOrari();
  if (!orari) return;
  db.settings.orariLavoro = orari;
  saveDB();
  /* Il calendario segna chiusure e giornate piene dagli orari. */
  renderAll();
  closeSheet('sheetOrari');
  toast('Orari aggiornati.', 'ok');
});

$('#servicesReset').addEventListener('click', async () => {
  const ok = await ask('Ripristinare il listino?',
    'Le voci iniziali tornano con nome, durata e prezzo di partenza. ' +
    'I servizi aggiunti da te restano, e gli appuntamenti già registrati non cambiano.',
    'Ripristina');
  if (!ok) return;
  const tuoi = db.services.filter(s => !isServizioIniziale(s.id));
  db.services = DEFAULT_SERVICES.map(s => Object.assign({}, s)).concat(tuoi);
  saveDB();
  renderServices();
  renderSelectOptions();
  toast('Listino ripristinato.', 'warn');
});

/* --- PIN -------------------------------------------------- */
$('#formPin').addEventListener('submit', event => {
  event.preventDefault();
  const oldPin = $('#pinOld').value.trim();
  const newPin = $('#pinNew').value.trim();

  if (hashPin(oldPin) !== db.settings.pinHash) {
    toast('Il PIN attuale non è corretto.', 'error');
    return;
  }
  if (!/^\d{4,8}$/.test(newPin)) {
    toast('Il nuovo PIN deve avere da 4 a 8 cifre.', 'error');
    return;
  }
  db.settings.pinHash = hashPin(newPin);
  db.settings.pinCambiato = true;
  /* Data del cambio, solo come riferimento tecnico nel database: non si
     mostra da nessuna parte nell'app. */
  db.settings.pinCambiatoIl = new Date().toISOString();
  saveDB();
  event.target.reset();
  closeSheet('sheetPin');
  toast('PIN aggiornato.', 'ok');
});

/* ============================================================
   12. FILE E RESOCONTI
   ============================================================ */

/**
 * I file che escono dall'app: l'agenda per il calendario.
 *
 * Nel browser normale — l'app installata, Laragon — si scarica con un
 * link, come sempre. Dentro il visualizzatore online la pagina non ha
 * il permesso di scaricare da sola e il link non farebbe niente: lì
 * passa dal salvataggio guidato, che chiede conferma. La scelta è
 * automatica, così i file dell'app restano gli stessi nei due casi.
 */
function saveFile(filename, content, mime) {
  const viaHost = window.claude && typeof window.claude.use === 'function';

  if (viaHost) {
    window.claude.use('downloads').then(downloads => {
      if (!downloads) { saveFileFallback(filename, content, mime); return; }
      downloads.save({ filename, data: content })
        .then(() => toast('File salvato.', 'ok'))
        .catch(err => {
          const code = err && err.code;
          if (code === 'declined') return;                 // ha detto di no: nessun avviso
          if (code === 'rejected_extension') {
            toast('L\'anteprima online non accetta i file .ics. ' +
                  'L\'esportazione nel calendario funziona nell\'app installata.', 'warn', 7000);
            return;
          }
          toast('Salvataggio non riuscito. ' + ((err && err.message) || 'errore'), 'error', 5000);
        });
    });
    return;
  }
  saveFileFallback(filename, content, mime);
}

function saveFileFallback(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Safari su iPhone legge il file dopo il clic, non durante: revocare
     subito l'indirizzo a volte gli lasciava in mano un file vuoto. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------
   I resoconti.
   Un foglio A4 già impaginato, del mese o dell'anno, da stampare
   o salvare in PDF dalla finestra di stampa del telefono. I conti
   sono gli stessi della sezione Conti: incassi = trattamenti
   segnati come completati, e nient'altro.
   ------------------------------------------------------------ */

/** "2026-09" → "Settembre 2026". */
function nomeMese(ym) {
  const [y, m] = String(ym).split('-');
  return `${capitalize(MESI_LUNGHI[Number(m) - 1])} ${y}`;
}

/** Mesi e anni con dei movimenti, dal più recente; il mese corrente c'è sempre. */
function renderReportPeriods() {
  const mesi = new Set([toKey(new Date()).slice(0, 7)]);
  db.appointments.forEach(a => mesi.add(String(a.data).slice(0, 7)));
  db.expenses.forEach(e => mesi.add(String(e.data).slice(0, 7)));
  db.incomes.forEach(i => mesi.add(String(i.data).slice(0, 7)));
  const elenco = [...mesi].filter(m => /^\d{4}-\d{2}$/.test(m)).sort().reverse();

  const sel = $('#reportPeriod');
  const prima = sel.value;
  sel.innerHTML =
    `<optgroup label="Un mese">${elenco.map(m => `<option value="${m}">${esc(nomeMese(m))}</option>`).join('')}</optgroup>` +
    `<optgroup label="Un anno intero">${knownYears().map(y => `<option value="${y}">Anno ${y}</option>`).join('')}</optgroup>`;
  sel.value = [...sel.options].some(o => o.value === prima) ? prima : toKey(new Date()).slice(0, 7);
}

function raggruppa(list, chiave, campo) {
  const gruppi = new Map();
  list.forEach(x => {
    const k = chiave(x);
    const g = gruppi.get(k) || { nome: k, quanti: 0, totale: 0 };
    g.quanti += 1;
    g.totale += Number(x[campo]) || 0;
    gruppi.set(k, g);
  });
  return [...gruppi.values()].sort((a, b) => b.totale - a.totale || a.nome.localeCompare(b.nome));
}

/** Tutto quello che serve al foglio, per un prefisso "YYYY" o "YYYY-MM". */
function datiResoconto(prefisso) {
  const dentro = d => String(d).startsWith(prefisso);
  const fatti = db.appointments
    .filter(a => a.stato === 'done' && dentro(a.data))
    .sort((a, b) => (a.data + a.ora).localeCompare(b.data + b.ora));
  const spese = db.expenses
    .filter(e => dentro(e.data))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  /* I guadagni dei trattamenti sono già nei `fatti`: qui solo quelli a mano. */
  const entrate = db.incomes
    .filter(i => guadagnoAMano(i) && dentro(i.data))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));

  const daTrattamenti = sum(fatti, 'prezzo');
  const incassi = daTrattamenti + sum(entrate, 'importo');
  const uscite = sum(spese, 'importo');

  return {
    fatti, spese, entrate, incassi, uscite, daTrattamenti,
    netto: incassi - uscite,
    perServizio: [
      ...raggruppa(fatti, a => a.servizio || 'Senza servizio', 'prezzo'),
      ...raggruppa(entrate, i => i.categoria || 'Altro', 'importo')
    ].sort((a, b) => b.totale - a.totale || a.nome.localeCompare(b.nome)),
    perCategoria: raggruppa(spese, e => e.categoria || 'Altro', 'importo')
  };
}

/* ---------- i pezzi del foglio ---------- */

function rpTesta(tipo, titolo) {
  const oggi = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return `
    <header class="rp-head">
      <div>
        <p class="rp-kicker">${esc(tipo)}</p>
        <h1 class="rp-title">${esc(titolo)}</h1>
      </div>
      <div class="rp-meta">
        <strong>${esc(CONFIG.nome)}</strong>
        <span>Creato il ${esc(oggi)}</span>
      </div>
    </header>`;
}

function rpNumeri(d) {
  const media = d.fatti.length ? fmtEuro(d.daTrattamenti / d.fatti.length) : '—';
  return `
    <section class="rp-kpi">
      <div class="rp-kpi__main">
        <span>Netto</span>
        <b class="${d.netto < 0 ? 'neg' : ''}">${fmtSigned(d.netto)}</b>
        <small>guadagni meno spese</small>
      </div>
      <div class="rp-kpi__grid">
        <div><span>Guadagni</span><b>${fmtEuro(d.incassi)}</b></div>
        <div><span>Spese</span><b>${fmtEuro(d.uscite)}</b></div>
        <div><span>Trattamenti</span><b>${d.fatti.length}</b></div>
        <div><span>Media a trattamento</span><b>${media}</b></div>
      </div>
    </section>`;
}

/** Tabella con una barretta proporzionale: si legge anche in bianco e nero. */
function rpGruppi(titolo, gruppi, vuoto, colonnaQuanti) {
  if (!gruppi.length) {
    return `<section class="rp-sec"><h2>${esc(titolo)}</h2><p class="rp-empty">${esc(vuoto)}</p></section>`;
  }
  const max = Math.max(...gruppi.map(g => g.totale), 1);
  const tot = sum(gruppi, 'totale');
  return `
    <section class="rp-sec">
      <h2>${esc(titolo)}</h2>
      <table class="rp-table">
        <thead><tr><th>Voce</th><th class="num">${esc(colonnaQuanti)}</th><th class="num">Totale</th></tr></thead>
        <tbody>
          ${gruppi.map(g => `<tr>
            <td>
              <span class="rp-name">${esc(g.nome)}</span>
              <span class="rp-meter"><i style="width:${(g.totale / max) * 100}%"></i></span>
            </td>
            <td class="num">${g.quanti}</td>
            <td class="num">${fmtEuro(g.totale)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td>Totale</td><td class="num">${sum(gruppi, 'quanti')}</td><td class="num">${fmtEuro(tot)}</td></tr></tfoot>
      </table>
    </section>`;
}

function rpTrattamenti(d) {
  if (!d.fatti.length) {
    return `<section class="rp-sec"><h2>Trattamenti completati</h2><p class="rp-empty">Nessun trattamento completato in questo mese.</p></section>`;
  }
  return `
    <section class="rp-sec">
      <h2>Trattamenti completati</h2>
      <table class="rp-table rp-table--list">
        <thead><tr><th>Data</th><th>Cliente</th><th>Servizio</th><th class="num">Importo</th></tr></thead>
        <tbody>
          ${d.fatti.map(a => `<tr>
            <td class="rp-when">${esc(fmtDayShort.format(fromKey(a.data)))} <span>${esc(a.ora)}</span></td>
            <td>${esc(clientLabel(a))}</td>
            <td>${esc(a.servizio)}</td>
            <td class="num">${fmtEuro(a.prezzo)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="3">Totale trattamenti</td><td class="num">${fmtEuro(d.daTrattamenti)}</td></tr></tfoot>
      </table>
    </section>`;
}

/** I guadagni aggiunti a mano: la sezione c'è solo se ce ne sono. */
function rpEntrate(d) {
  if (!d.entrate.length) return '';
  return `
    <section class="rp-sec">
      <h2>Altri guadagni</h2>
      <table class="rp-table rp-table--list">
        <thead><tr><th>Data</th><th>Descrizione</th><th>Tipo</th><th class="num">Importo</th></tr></thead>
        <tbody>
          ${d.entrate.map(i => `<tr>
            <td class="rp-when">${esc(fmtDayShort.format(fromKey(i.data)))}</td>
            <td>${esc(incomeTitle(i))}${i.cliente ? `<span class="rp-sub">${esc(i.cliente)}</span>` : ''}</td>
            <td>${esc(i.categoria || 'Altro')}</td>
            <td class="num">${fmtEuro(i.importo)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="3">Totale altri guadagni</td><td class="num">${fmtEuro(sum(d.entrate, 'importo'))}</td></tr></tfoot>
      </table>
    </section>`;
}

function rpSpese(d) {
  if (!d.spese.length) {
    return `<section class="rp-sec"><h2>Spese</h2><p class="rp-empty">Nessuna spesa registrata in questo mese.</p></section>`;
  }
  return `
    <section class="rp-sec">
      <h2>Spese</h2>
      <table class="rp-table rp-table--list">
        <thead><tr><th>Data</th><th>Descrizione</th><th>Categoria</th><th class="num">Importo</th></tr></thead>
        <tbody>
          ${d.spese.map(e => `<tr>
            <td class="rp-when">${esc(fmtDayShort.format(fromKey(e.data)))}</td>
            <td>${esc(e.descrizione)}${e.fornitore ? `<span class="rp-sub">${esc(e.fornitore)}</span>` : ''}</td>
            <td>${esc(e.categoria || 'Altro')}</td>
            <td class="num">${fmtEuro(e.importo)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="3">Totale spese</td><td class="num">${fmtEuro(d.uscite)}</td></tr></tfoot>
      </table>
    </section>`;
}

/** Barre affiancate in SVG: restano nitide in stampa e nel PDF. */
function rpGrafico(rows) {
  const W = 680, H = 190, sx = 46, top = 10, base = H - 24;
  const max = Math.max(1, ...rows.map(r => Math.max(r.incassi, r.uscite)));
  const step = niceStep(max / 3);
  const cima = Math.max(step, Math.ceil(max / step) * step);
  const y = v => base - (v / cima) * (base - top);
  const larg = (W - sx) / 12;
  const barra = Math.min(16, larg * 0.32);

  let griglia = '';
  for (let v = 0; v <= cima + 0.001; v += step) {
    griglia += `<line x1="${sx}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="rp-grid"/>` +
      `<text x="${sx - 6}" y="${y(v) + 3}" text-anchor="end" class="rp-axis">${esc(fmtEuroTondo(v))}</text>`;
  }
  const barre = rows.map((r, i) => {
    const cx = sx + larg * i + larg / 2;
    return `<rect x="${cx - barra - 1}" y="${y(r.incassi)}" width="${barra}" height="${base - y(r.incassi)}" rx="2" class="rp-bar-in"/>` +
      `<rect x="${cx + 1}" y="${y(r.uscite)}" width="${barra}" height="${base - y(r.uscite)}" rx="2" class="rp-bar-out"/>` +
      `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="rp-axis">${MESI_BREVI[r.mese]}</text>`;
  }).join('');

  return `
    <section class="rp-sec">
      <div class="rp-sec__head">
        <h2>Andamento mese per mese</h2>
        <p class="rp-legend"><i class="rp-dot-in"></i>Guadagni <i class="rp-dot-out"></i>Spese</p>
      </div>
      <svg class="rp-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Guadagni e spese mese per mese">${griglia}${barre}</svg>
    </section>`;
}

function rpMesi(rows) {
  const tot = { i: sum(rows, 'incassi'), u: sum(rows, 'uscite'), t: rows.reduce((s, r) => s + r.trattamenti, 0) };
  return `
    <section class="rp-sec">
      <h2>I mesi</h2>
      <table class="rp-table">
        <thead><tr><th>Mese</th><th class="num">Trattamenti</th><th class="num">Guadagni</th><th class="num">Spese</th><th class="num">Netto</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>${capitalize(MESI_LUNGHI[r.mese])}</td>
            <td class="num">${r.trattamenti}</td>
            <td class="num">${fmtEuro(r.incassi)}</td>
            <td class="num">${fmtEuro(r.uscite)}</td>
            <td class="num${r.netto < 0 ? ' neg' : ''}">${fmtSigned(r.netto)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <td>Totale</td><td class="num">${tot.t}</td>
          <td class="num">${fmtEuro(tot.i)}</td><td class="num">${fmtEuro(tot.u)}</td>
          <td class="num${tot.i - tot.u < 0 ? ' neg' : ''}">${fmtSigned(tot.i - tot.u)}</td>
        </tr></tfoot>
      </table>
    </section>`;
}

function resocontoMese(ym) {
  const d = datiResoconto(ym);
  return rpTesta('Resoconto mensile', nomeMese(ym)) + rpNumeri(d) +
    `<div class="rp-cols">
      ${rpGruppi('Guadagni per voce', d.perServizio, 'Nessun guadagno.', 'Volte')}
      ${rpGruppi('Spese per categoria', d.perCategoria, 'Nessuna spesa.', 'Voci')}
    </div>` +
    rpTrattamenti(d) + rpEntrate(d) + rpSpese(d);
}

function resocontoAnno(anno) {
  const d = datiResoconto(String(anno));
  const rows = yearRows(anno);
  return rpTesta('Resoconto annuale', `Anno ${anno}`) + rpNumeri(d) + rpGrafico(rows) + rpMesi(rows) +
    `<div class="rp-cols">
      ${rpGruppi('Guadagni per voce', d.perServizio, 'Nessun guadagno.', 'Volte')}
      ${rpGruppi('Spese per categoria', d.perCategoria, 'Nessuna spesa.', 'Voci')}
    </div>`;
}

/* ---------- apertura, stampa, chiusura ---------- */

function apriResoconto(periodo) {
  const anno = /^\d{4}$/.test(periodo);
  $('#reportPage').innerHTML = anno ? resocontoAnno(Number(periodo)) : resocontoMese(periodo);

  const report = $('#report');
  /* Il titolo della pagina è il nome che il telefono propone per il
     PDF: "Resoconto settembre 2026" si ritrova fra i documenti. */
  report.dataset.titolo = document.title;
  document.title = `Resoconto ${anno ? periodo : nomeMese(periodo).toLowerCase()}`;

  closeSheet('sheetBackup');
  report.hidden = false;
  report.scrollTop = 0;
  document.body.classList.add('is-report');
}

function chiudiResoconto() {
  const report = $('#report');
  if (report.hidden) return;
  report.hidden = true;
  document.body.classList.remove('is-report');
  if (report.dataset.titolo) document.title = report.dataset.titolo;
  $('#reportPage').innerHTML = '';     // niente dati delle clienti lasciati nella pagina
}

$('#btnReport').addEventListener('click', () => apriResoconto($('#reportPeriod').value));
$('#reportClose').addEventListener('click', chiudiResoconto);
$('#reportPrint').addEventListener('click', () => {
  if (typeof window.print === 'function') window.print();
  else toast('Questo browser non sa stampare: apri l\'app in Safari o Chrome.', 'warn', 6000);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') chiudiResoconto();
});

/* Demo: "Ripristina la demo" in Impostazioni. */
$('#menuReset').addEventListener('click', async () => {
  const ok = await ask('Ripristinare la demo?',
    'Le modifiche fatte in questo browser si cancellano e tornano i dati di esempio.',
    'Ripristina');
  if (!ok) return;
  resetDemo();
  toast('Demo ripristinata.', 'ok');
});

/* ============================================================
   12bis. MENU A TENDINA IN GRAFICA
   ------------------------------------------------------------
   Il <select> resta dov'è, nascosto: è lui che tiene il valore, e
   tutto il resto dell'app continua a leggerlo e scriverlo come
   prima. Al suo posto si vede un pulsante con la voce scelta;
   toccandolo, le voci scendono a tendina proprio sotto al campo —
   niente rotella di sistema e niente pannello dal basso.
   ============================================================ */

const valoreNativo = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
const indiceNativo = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
const SPUNTA = '<svg class="picker__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

/** Il nome del menu: l'etichetta del campo, o quella nascosta per i lettori di schermo. */
function titoloMenu(sel) {
  const etichetta = sel.closest('label') || (sel.id && $(`label[for="${sel.id}"]`));
  const testo = etichetta && $('span', etichetta);
  return (testo && testo.textContent.trim()) || sel.getAttribute('aria-label') || 'Scegli';
}

/**
 * Il testo del pulsante si riscrive solo se cambia davvero. Riscriverlo
 * uguale mentre il dito è sopra (succede quando un campo perde il
 * fuoco proprio al tocco) basta a Safari per annullare il tocco.
 */
function scriviEtichetta(btn, testo, nome) {
  if (btn.textContent !== testo) btn.textContent = testo;
  const aria = `${nome}: ${testo}`;
  if (btn.getAttribute('aria-label') !== aria) btn.setAttribute('aria-label', aria);
}

function abbellisciSelect(sel) {
  if (sel.dataset.picker) return;
  sel.dataset.picker = '1';
  sel.classList.add('picker-native');
  sel.tabIndex = -1;

  /* Pulsante e tendina stanno insieme in un contenitore: la tendina
     si appoggia sotto al pulsante e scorre con lui. */
  const wrap = document.createElement('div');
  wrap.className = 'picker-wrap';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'picker';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  const lista = document.createElement('ul');
  lista.className = 'dropdown';
  lista.setAttribute('role', 'listbox');
  lista.hidden = true;
  wrap.append(btn, lista);
  sel.after(wrap);

  const aggiorna = () => {
    const opt = sel.options[sel.selectedIndex];
    scriviEtichetta(btn, opt ? opt.textContent : '—', titoloMenu(sel));
  };

  /* Il valore cambia anche da codice (sel.value = …), che non manda
     nessun evento: si intercetta qui, così il pulsante non resta
     indietro. Le voci rifatte da capo le segnala l'osservatore. */
  Object.defineProperty(sel, 'value', {
    get() { return valoreNativo.get.call(this); },
    set(v) { valoreNativo.set.call(this, v); aggiorna(); }
  });
  Object.defineProperty(sel, 'selectedIndex', {
    get() { return indiceNativo.get.call(this); },
    set(v) { indiceNativo.set.call(this, v); aggiorna(); }
  });
  new MutationObserver(aggiorna).observe(sel, { childList: true, subtree: true, characterData: true });
  sel.addEventListener('change', aggiorna);
  sel.aggiornaPicker = aggiorna;

  btn.addEventListener('click', event => {
    /* Dentro un'etichetta il tocco andrebbe anche al <select>. */
    event.preventDefault();
    if (lista.hidden) apriTendina(sel, btn, lista);
    else chiudiTendine();
  });

  lista.addEventListener('click', event => {
    event.preventDefault();
    const voce = event.target.closest('[data-i]');
    if (!voce) return;
    chiudiTendine();
    const prima = sel.selectedIndex;
    sel.selectedIndex = Number(voce.dataset.i);
    if (sel.selectedIndex !== prima) sel.dispatchEvent(new Event('change', { bubbles: true }));
    btn.focus();
  });

  aggiorna();
}

function apriTendina(sel, btn, lista) {
  chiudiTendine();
  const voce = o => `<li><button type="button" class="picker__opt${o.selected ? ' is-sel' : ''}" role="option"
      aria-selected="${o.selected}" data-i="${o.index}"><span>${esc(o.textContent)}</span>${o.selected ? SPUNTA : ''}</button></li>`;
  lista.innerHTML = [...sel.children].map(el => el.tagName === 'OPTGROUP'
    ? `<li class="picker__group">${esc(el.label)}</li>` + [...el.children].map(voce).join('')
    : voce(el)).join('');
  lista.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  btn.closest('.picker-wrap').classList.add('is-open');

  /* La voce scelta in vista dentro la tendina, e la tendina intera in
     vista dentro la pagina: vicino al fondo, la pagina sale quanto basta. */
  const scelta = $('.is-sel', lista);
  if (scelta) lista.scrollTop = scelta.offsetTop - lista.clientHeight / 2 + scelta.offsetHeight / 2;
  lista.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function chiudiTendine() {
  $$('.dropdown').forEach(l => {
    if (l.hidden) return;
    l.hidden = true;
    const wrap = l.closest('.picker-wrap');
    wrap.classList.remove('is-open');
    $('.picker', wrap).setAttribute('aria-expanded', 'false');
  });
}

/* Un tocco fuori, o Esc, chiude la tendina senza cambiare niente. */
document.addEventListener('click', event => {
  if (!event.target.closest('.picker-wrap')) chiudiTendine();
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') chiudiTendine();
});

/* form.reset() riporta i menu alla prima voce senza dirlo a nessuno:
   subito dopo, i pulsanti rileggono il valore. */
document.addEventListener('reset', event => {
  setTimeout(() => $$('select, input[type="date"]', event.target).forEach(s => s.aggiornaPicker && s.aggiornaPicker()), 0);
}, true);

/* --- Il calendario dei moduli -----------------------------
   Come i menu: il campo data vero resta nascosto e tiene il valore;
   si vede un pulsante con il giorno scritto per esteso, e toccandolo
   scende sotto il calendario del mese, con le stesse caselle
   dell'Agenda. Nel modulo appuntamento i giorni di chiusura sono
   tratteggiati, e i giorni prima di "min" non si toccano. */
const valoreDataNativo = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

/* Nel campo il giorno sta in breve — "Lun 5 ott 2026" — perché il
   campo è largo metà riga; per esteso lo legge il lettore di schermo. */
const fmtDataCampo = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function etichettaData(key) {
  if (!key) return 'Scegli il giorno';
  if (key === toKey(new Date())) return 'Oggi';
  return capitalize(fmtDataCampo.format(fromKey(key)).replace(/\./g, ''));
}

function abbellisciData(input) {
  if (input.dataset.picker) return;
  input.dataset.picker = '1';
  input.classList.add('picker-native');
  input.tabIndex = -1;

  const wrap = document.createElement('div');
  wrap.className = 'picker-wrap';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'picker picker--date';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  const pop = document.createElement('div');
  pop.className = 'dropdown calpop';
  pop.hidden = true;
  wrap.append(btn, pop);
  input.after(wrap);

  const aggiorna = () => {
    const key = valoreDataNativo.get.call(input);
    scriviEtichetta(btn, etichettaData(key), key ? capitalize(fmtDayFull.format(fromKey(key))) : 'Data');
  };
  Object.defineProperty(input, 'value', {
    get() { return valoreDataNativo.get.call(this); },
    set(v) { valoreDataNativo.set.call(this, v); aggiorna(); }
  });
  input.addEventListener('change', aggiorna);
  input.aggiornaPicker = aggiorna;

  let mese = null;   // il mese mostrato, primo giorno

  const disegna = () => {
    const scelto = input.value;
    const min = input.min || '';
    const oggi = toKey(new Date());
    const primo = startOfMonth(mese);
    const offset = (primo.getDay() + 6) % 7;
    const giorniMese = new Date(primo.getFullYear(), primo.getMonth() + 1, 0).getDate();
    const celle = Math.ceil((offset + giorniMese) / 7) * 7;
    const inizio = startOfWeek(primo);
    let giorni = '';
    for (let i = 0; i < celle; i++) {
      const d = addDays(inizio, i);
      const key = toKey(d);
      const cl = ['day'];
      if (d.getMonth() !== primo.getMonth()) cl.push('day--out');
      if (key === oggi) cl.push('day--today');
      if (key === scelto) cl.push('day--sel');
      if (input.id === 'fData' && !turniDelGiorno(key).length) cl.push('day--closed');
      const spento = min && key < min;
      giorni += `<button type="button" class="${cl.join(' ')}" data-giorno="${key}"${spento ? ' disabled' : ''}
        aria-label="${esc(fmtDayLong.format(d))}"><span class="day__n">${d.getDate()}</span></button>`;
    }
    const indietroNo = min && toKey(addDays(primo, -1)) < min;
    pop.innerHTML = `
      <div class="calnav calpop__nav">
        <button class="iconbtn iconbtn--sm" type="button" data-mese="-1" aria-label="Mese precedente"${indietroNo ? ' disabled' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>
        </button>
        <strong>${esc(capitalize(fmtMonth.format(primo)))}</strong>
        <button class="iconbtn iconbtn--sm" type="button" data-mese="1" aria-label="Mese successivo">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
        </button>
      </div>
      <div class="caldow" aria-hidden="true"><span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span></div>
      <div class="calgrid">${giorni}</div>
      <button class="linkbtn linkbtn--center" type="button" data-oggi>Oggi</button>`;
  };

  btn.addEventListener('click', event => {
    event.preventDefault();
    if (!pop.hidden) { chiudiTendine(); return; }
    chiudiTendine();
    mese = startOfMonth(input.value ? fromKey(input.value) : new Date());
    disegna();
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    pop.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  pop.addEventListener('click', event => {
    event.preventDefault();
    const nav = event.target.closest('[data-mese]');
    if (nav && !nav.disabled) {
      mese = new Date(mese.getFullYear(), mese.getMonth() + Number(nav.dataset.mese), 1);
      disegna();
      return;
    }
    const oggiBtn = event.target.closest('[data-oggi]');
    const giorno = event.target.closest('[data-giorno]');
    const key = oggiBtn ? toKey(new Date()) : giorno && !giorno.disabled ? giorno.dataset.giorno : null;
    if (!key) return;
    chiudiTendine();
    if (key !== input.value) {
      input.value = key;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    btn.focus();
  });

  aggiorna();
}

function abbellisciMenu() {
  $$('select').forEach(abbellisciSelect);
  $$('input[type="date"]').forEach(abbellisciData);
}

/* ============================================================
   13. BOOTSTRAP
   ============================================================ */

/* Il "?i=1" lo aggiunge il controllo anti-bot dell'hosting gratuito,
   prima ancora che la pagina arrivi: non si può evitare, ma si toglie
   dalla barra degli indirizzi senza ricaricare niente. */
if (window.history && /[?&]i=1\b/.test(location.search)) {
  const pulito = new URLSearchParams(location.search);
  pulito.delete('i');
  const resto = pulito.toString();
  history.replaceState(history.state, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
}

renderSelectOptions();
abbellisciMenu();


/* La voce di cronologia da cui si parte porta con se' la sezione:
   senza, il primo "indietro" non saprebbe dove tornare. */
segnaSezione(sezioneDallIndirizzo(), false);

/* Si riparte da dove si era rimasti, se l'ultimo utilizzo e' recente.
   Passati i minuti del blocco automatico — o dopo un blocco chiesto a
   mano — si ricomincia dal PIN. */
if (sbloccoAncoraValido()) {
  unlockApp();
} else {
  scordaSblocco();
  lockApp(true);
}
fitToVisibleArea();
fitStandalone();

/* Il saluto al database parte per conto suo, senza che nessuno
   aspetti: l'app è già in piedi e lavorabile con la copia
   locale. Se il server risponde, al massimo aggiorna quello che
   si vede; se non risponde, non se ne accorge nessuno finché non
   si apre "Copia online". */
allineaAllAvvio();

/* Tornata la rete dopo un momento di buio, la prima cosa da fare
   è recuperare quello che nel frattempo era rimasto in tasca. */
window.addEventListener('online', () => {
  if (Nuvola.daInviare) inviaArchivio();
});

/* Tornando sull'app si rilegge il database. Su iPhone l'app
   aperta dalla schermata Home non si ricarica quasi mai: senza
   questo, un appuntamento preso dal computer non comparirebbe sul
   telefono finché la pagina non ripartisce da zero. Al massimo una
   volta ogni 20 secondi, e mai mentre un invio è per aria. */
let ultimaRilettura = Date.now();
function rileggiSeServe() {
  if (!CONFIG.api || document.visibilityState !== 'visible') return;
  if (Nuvola.inCorso || Date.now() - ultimaRilettura < 20000) return;
  ultimaRilettura = Date.now();
  if (Nuvola.daInviare) inviaArchivio();
  else allineaAllAvvio();
}
document.addEventListener('visibilitychange', rileggiSeServe);
window.addEventListener('pageshow', rileggiSeServe);

/* Controllo periodico, con l'app aperta in primo piano: ogni 30 secondi
   si guarda se il server è più avanti. rileggiSeServe salta da solo se
   la scheda è nascosta, se un invio è in corso o se è passato troppo
   poco (throttle di 20s). Senza questo, una modifica fatta altrove — o
   direttamente nel database — comparirebbe solo cambiando scheda o
   ricaricando. */
setInterval(rileggiSeServe, 30000);

console.info(
  `Gestionale pronto — ${db.appointments.length} appuntamenti, ` +
  `${db.clients.length} clienti, ${db.expenses.length} spese, ${db.incomes.length} altri guadagni.`
);
