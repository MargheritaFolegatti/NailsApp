/* Dati finti della demo: clienti, appuntamenti, conti. Nomi e numeri sono di fantasia.
   Stesso formato dell'archivio dell'app vera (l'oggetto db di script.js,
   le tabelle di api/schema.sql). Il listino è DEFAULT_SERVICES di script.js.
   Appuntamenti e guadagni non hanno date fisse: li crea defaultState()
   a partire da OGGI, così la demo sembra sempre "in corso". */

const CLIENTI_SEED = [
  { nome: 'Giulia',     cognome: 'Ferraro',   via: 'Via delle Rose', civico: '12', cap: '40121', citta: 'Bologna', provincia: 'BO', note: 'Preferisce i colori nude. Unghie sottili: niente lima elettrica sulla lamina.' },
  { nome: 'Martina',    cognome: 'Galli',     note: 'Viene sempre il sabato mattina.' },
  { nome: 'Chiara',     cognome: 'Lombardi',  via: 'Via Saragozza', civico: '45', cap: '40123', citta: 'Bologna', provincia: 'BO', note: '' },
  { nome: 'Francesca',  cognome: 'Moretti',   note: 'Allergica al lattice: usare guanti in nitrile.' },
  { nome: 'Sara',       cognome: 'Colombo',   note: '' },
  { nome: 'Alessia',    cognome: 'Rinaldi',   via: 'Via Emilia Levante', civico: '88', cap: '40139', citta: 'Bologna', provincia: 'BO', note: 'Trattamento a domicilio, citofono "Rinaldi-Bassi".' },
  { nome: 'Valentina',  cognome: 'Barbieri',  note: 'Ama la nail art: chiedere sempre il tema del mese.' },
  { nome: 'Elena',      cognome: 'Fontana',   note: '' },
  { nome: 'Federica',   cognome: 'Santoro',   via: 'Via del Pratello', civico: '7', cap: '40122', citta: 'Bologna', provincia: 'BO', note: '' },
  { nome: 'Silvia',     cognome: 'Mariani',   note: 'Pelle sensibile ai piedi.' },
  { nome: 'Beatrice',   cognome: 'Conti',     note: '' },
  { nome: 'Noemi',      cognome: 'Pellegrini', note: 'Studentessa: ha lo sconto del 10%.' },
  { nome: 'Ilaria',     cognome: 'Caruso',    via: 'Via Andrea Costa', civico: '150', cap: '40134', citta: 'Bologna', provincia: 'BO', note: '' },
  { nome: 'Roberta',    cognome: 'De Luca',   note: 'Arriva spesso 10 minuti in anticipo.' },
  { nome: 'Camilla',    cognome: 'Greco',     note: '' }
].map((c, i) => ({
  via: '', civico: '', cap: '', citta: '', provincia: '',
  ...c,
  telefono: '333 000 00' + String(i + 1).padStart(2, '0')
}));

/* Le spese non hanno una data fissa: `mesiFa` dice quanti mesi fa
   (0 = questo mese), `giorno` il giorno del mese. */
const SPESE_SEED = [
  { mesiFa: 0, giorno: 2,  importo: 64.90, categoria: 'Prodotti',           descrizione: 'Smalti semipermanenti',  fornitore: 'NailPoint Forniture' },
  { mesiFa: 0, giorno: 3,  importo: 18.50, categoria: 'Monouso e igiene',   descrizione: 'Guanti',                 fornitore: 'Farmacia San Marco' },
  { mesiFa: 0, giorno: 4,  importo: 45.00, categoria: 'Spazio e utenze',    descrizione: 'Quota affitto postazione', fornitore: 'Studio Estetico Iris' },

  { mesiFa: 1, giorno: 3,  importo: 89.00, categoria: 'Prodotti',           descrizione: 'Gel costruttore',        fornitore: 'NailPoint Forniture' },
  { mesiFa: 1, giorno: 8,  importo: 22.40, categoria: 'Monouso e igiene',   descrizione: 'Salviette e carta',      fornitore: 'Casalinghi Moretti' },
  { mesiFa: 1, giorno: 12, importo: 34.99, categoria: 'Attrezzatura',       descrizione: 'Lime e buffer',          fornitore: 'Amazon' },
  { mesiFa: 1, giorno: 18, importo: 27.80, categoria: 'Prodotti',           descrizione: 'Base e top coat',        fornitore: 'Ingrosso Bellezza Sud' },
  { mesiFa: 1, giorno: 22, importo: 15.90, categoria: 'Monouso e igiene',   descrizione: 'Disinfettante',          fornitore: 'Farmacia San Marco' },
  { mesiFa: 1, giorno: 1,  importo: 90.00, categoria: 'Spazio e utenze',    descrizione: 'Quota affitto postazione', fornitore: 'Studio Estetico Iris' },

  { mesiFa: 2, giorno: 2,  importo: 129.00, categoria: 'Attrezzatura',      descrizione: 'Lampada UV/LED',         fornitore: 'Amazon' },
  { mesiFa: 2, giorno: 6,  importo: 52.30, categoria: 'Prodotti',           descrizione: 'Smalti semipermanenti',  fornitore: 'NailPoint Forniture' },
  { mesiFa: 2, giorno: 14, importo: 12.00, categoria: 'Monouso e igiene',   descrizione: 'Cotone e dischetti',     fornitore: 'Casalinghi Moretti' },
  { mesiFa: 2, giorno: 20, importo: 38.70, categoria: 'Prodotti',           descrizione: 'Decorazioni nail art',   fornitore: 'Ingrosso Bellezza Sud' },
  { mesiFa: 2, giorno: 1,  importo: 90.00, categoria: 'Spazio e utenze',    descrizione: 'Quota affitto postazione', fornitore: 'Studio Estetico Iris' },

  { mesiFa: 3, giorno: 4,  importo: 180.00, categoria: 'Corsi e formazione', descrizione: 'Corso nail art avanzato', fornitore: 'Accademia Unghie Bologna' },
  { mesiFa: 3, giorno: 9,  importo: 46.20, categoria: 'Prodotti',           descrizione: 'Acrygel',                fornitore: 'NailPoint Forniture' },
  { mesiFa: 3, giorno: 15, importo: 19.90, categoria: 'Monouso e igiene',   descrizione: 'Mascherine',             fornitore: 'Farmacia San Marco' },
  { mesiFa: 3, giorno: 23, importo: 24.50, categoria: 'Attrezzatura',       descrizione: 'Pennelli',               fornitore: 'Amazon' },
  { mesiFa: 3, giorno: 1,  importo: 90.00, categoria: 'Spazio e utenze',    descrizione: 'Quota affitto postazione', fornitore: 'Studio Estetico Iris' },

  { mesiFa: 4, giorno: 5,  importo: 74.60, categoria: 'Prodotti',           descrizione: 'Primer e dehydrator',    fornitore: 'Ingrosso Bellezza Sud' },
  { mesiFa: 4, giorno: 11, importo: 16.80, categoria: 'Monouso e igiene',   descrizione: 'Tips e cartine',         fornitore: 'NailPoint Forniture' },
  { mesiFa: 4, giorno: 17, importo: 59.00, categoria: 'Attrezzatura',       descrizione: 'Aspiratore polveri',     fornitore: 'Amazon' },
  { mesiFa: 4, giorno: 24, importo: 31.40, categoria: 'Prodotti',           descrizione: 'Cleaner e remover',      fornitore: 'NailPoint Forniture' },
  { mesiFa: 4, giorno: 1,  importo: 90.00, categoria: 'Spazio e utenze',    descrizione: 'Quota affitto postazione', fornitore: 'Studio Estetico Iris' },

  { mesiFa: 5, giorno: 3,  importo: 149.00, categoria: 'Attrezzatura',      descrizione: 'Fresa e punte',          fornitore: 'Amazon' },
  { mesiFa: 5, giorno: 10, importo: 68.90, categoria: 'Prodotti',           descrizione: 'Smalti semipermanenti',  fornitore: 'NailPoint Forniture' },
  { mesiFa: 5, giorno: 16, importo: 21.00, categoria: 'Monouso e igiene',   descrizione: 'Guanti',                 fornitore: 'Farmacia San Marco' },
  { mesiFa: 5, giorno: 21, importo: 26.30, categoria: 'Prodotti',           descrizione: 'Base e top coat',        fornitore: 'Ingrosso Bellezza Sud' },
  { mesiFa: 5, giorno: 1,  importo: 90.00, categoria: 'Spazio e utenze',    descrizione: 'Quota affitto postazione', fornitore: 'Studio Estetico Iris' }
];

const NEGOZI_SEED = [
  'Amazon', 'NailPoint Forniture', 'Ingrosso Bellezza Sud', 'Farmacia San Marco',
  'Casalinghi Moretti', 'Studio Estetico Iris', 'Accademia Unghie Bologna'
];

const CATEGORIE_SEED = {
  spese: ['Prodotti', 'Attrezzatura', 'Monouso e igiene', 'Corsi e formazione', 'Spazio e utenze'],
  entrate: ['Trattamento mani', 'Trattamento piedi', 'Trattamento mani e piedi', 'Babysitter', 'Vendita prodotti', 'Mancia']
};

const METODI_SEED = ['Contanti', 'Satispay', 'Bonifico', 'PayPal'];

/* Note che a volte accompagnano un appuntamento. */
const NOTE_APPUNTAMENTO_SEED = [
  'Colore: nude rosato', 'Vuole provare il french', 'Unghia dell\'anulare da riparare',
  'Tema autunnale', 'Forma a mandorla', 'Porta lei lo smalto', 'Glitter sulle punte'
];

/* --------------------------------------------------------------------------
   defaultState(): l'archivio di partenza, con date calcolate da oggi.
   Un generatore pseudo-casuale con seme fisso dà ogni volta la stessa
   agenda (spostata sul giorno in cui si apre la demo).
   -------------------------------------------------------------------------- */

function defaultState() {
  let seme = 20261106;
  const rnd = () => {               // mulberry32
    seme |= 0; seme = (seme + 0x6D2B79F5) | 0;
    let t = Math.imul(seme ^ (seme >>> 15), 1 | seme);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const scegli = lista => lista[Math.floor(rnd() * lista.length)];
  const pesato = coppie => {
    let r = rnd() * coppie.reduce((s, c) => s + c[1], 0);
    for (const [v, p] of coppie) { if ((r -= p) < 0) return v; }
    return coppie[0][0];
  };

  const pad = n => String(n).padStart(2, '0');
  const giornoKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const piuGiorni = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const minuti = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const ora = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const fromKeyDemo = k => { const [y, mo, d] = k.split('-').map(Number); return new Date(y, mo - 1, d); };
  const iso = (d, m = 600) => { const x = new Date(d); x.setHours(Math.floor(m / 60), m % 60, 0, 0); return x.toISOString(); };

  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const servizi = DEFAULT_SERVICES;
  const servizio = id => servizi.find(s => s.id === id);

  /* Le fasce di lavoro del giorno, dagli orari di partenza dell'app. */
  const fasceDi = d => {
    const g = DEFAULT_ORARI[d.getDay()] || {};
    return ['mattina', 'pomeriggio', 'sera'].map(k => g[k]).filter(f => f && f.attivo)
      .map(f => [minuti(f.da), minuti(f.a)]);
  };

  /* Clienti: alcune fisse, altre di passaggio. */
  const creata = iso(piuGiorni(oggi, -200));
  const clients = CLIENTI_SEED.map((c, i) => ({
    id: String(i + 1), ...c, indirizzo: '', createdAt: creata, updatedAt: creata
  }));
  const pesoCliente = clients.map((c, i) => [c, i < 6 ? 3 : i < 11 ? 2 : 1]);
  const nomeCliente = c => `${c.nome} ${c.cognome}`;

  const SERVIZI_PESATI = [
    ['semi-mani', 30], ['refill', 16], ['gel-cover', 12], ['ricostruzione', 8], ['manicure', 10],
    ['semi-piedi', 9], ['pedicure', 7], ['rimozione', 4], ['riparazione', 2]
  ];
  const METODI_PESATI = [['Contanti', 50], ['Satispay', 25], ['Bonifico', 15], ['PayPal', 10]];

  const categoriaDi = (serviceId, aggiuntivi) =>
    aggiuntivi.some(a => a !== 'nailart') ? 'Trattamento mani e piedi'
      : /piedi|pedicure/.test(serviceId) ? 'Trattamento piedi' : 'Trattamento mani';

  /* Un trattamento a caso: servizio principale, a volte con un'aggiunta. */
  const trattamento = () => {
    const s = servizio(pesato(SERVIZI_PESATI));
    const aggiuntivi = [];
    if (s.id === 'semi-mani' && rnd() < 0.18) aggiuntivi.push('semi-piedi');
    if (['semi-mani', 'gel-cover', 'ricostruzione', 'refill'].includes(s.id) && rnd() < 0.2) aggiuntivi.push('nailart');
    const tutti = [s, ...aggiuntivi.map(servizio)];
    return {
      s, aggiuntivi,
      nome: tutti.map(x => x.nome).join(' + '),
      durata: tutti.reduce((t, x) => t + x.durata, 0),
      prezzo: tutti.reduce((t, x) => t + x.prezzo, 0)
    };
  };

  const appointments = [];
  const incomes = [];

  /* Agenda: da due settimane fa a tre settimane da oggi. Non tutti i
     giorni di lavoro hanno appuntamenti: circa uno su tre resta libero
     (oggi mai, così la demo si apre con qualcosa da vedere). */
  for (let g = -14; g <= 21; g++) {
    const giorno = piuGiorni(oggi, g);
    if (g !== 0 && rnd() < 0.33) continue;
    const vuoto = g === 0 ? 0.2 : g < 0 ? 0.4 : g <= 7 ? 0.4 : g <= 14 ? 0.55 : 0.7;
    fasceDi(giorno).forEach(([inizio, fine]) => {
      let t = inizio;
      while (t + 30 <= fine) {
        if (rnd() < vuoto) { t += 30; continue; }
        const tr = trattamento();
        if (t + tr.durata > fine) { t += 30; continue; }
        const c = pesato(pesoCliente);
        const quando = iso(piuGiorni(giorno, g < 0 ? 0 : -Math.ceil(rnd() * 10)), t);
        appointments.push({
          id: String(appointments.length + 1),
          clientId: c.id, nome: c.nome, cognome: c.cognome, telefono: c.telefono,
          serviceId: tr.s.id, aggiuntivi: tr.aggiuntivi, servizio: tr.nome,
          data: giornoKey(giorno), ora: ora(t), durata: tr.durata, prezzo: tr.prezzo,
          stato: g < 0 ? 'done' : 'wait',
          note: rnd() < 0.15 ? scegli(NOTE_APPUNTAMENTO_SEED) : '',
          createdAt: quando, updatedAt: quando
        });
        /* Il prossimo parte alla mezz'ora successiva, a volte con una pausa. */
        t = Math.ceil((t + tr.durata) / 30) * 30 + (rnd() < 0.3 ? 30 : 0);
      }
    });
  }

  /* Oggi: la prima metà degli appuntamenti è già completata (verde), il
     resto è ancora da fare (rosso), a qualunque ora si apra la demo. */
  const diOggi = appointments.filter(a => a.data === giornoKey(oggi));
  diOggi.slice(0, Math.ceil(diOggi.length / 2)).forEach(a => { a.stato = 'done'; });

  /* Due appuntamenti degli ultimi giorni restano da segnare: in Home
     compaiono nel riquadro "Da segnare". */
  appointments.filter(a => a.data < giornoKey(oggi)).slice(-4).filter((_, i) => i % 2 === 0)
    .forEach(a => { a.stato = 'wait'; });

  /* Ogni appuntamento completato ha il suo guadagno, come quando lo si
     segna completato nell'app. */
  appointments.filter(a => a.stato === 'done').forEach(a => {
    const fine = iso(fromKeyDemo(a.data), minuti(a.ora) + a.durata);
    incomes.push({
      id: String(incomes.length + 1), data: a.data, importo: a.prezzo,
      categoria: categoriaDi(a.serviceId, a.aggiuntivi), descrizione: a.servizio,
      cliente: `${a.nome} ${a.cognome}`, metodo: pesato(METODI_PESATI), appuntamentoId: a.id,
      createdAt: fine, updatedAt: fine
    });
  });

  /* Guadagni dei mesi prima dell'agenda: dall'inizio di cinque mesi fa
     fino al giorno prima del primo appuntamento in agenda. */
  const inizioStorico = new Date(oggi.getFullYear(), oggi.getMonth() - 5, 1);
  const aggiungiGuadagno = (giorno, importo, categoria, descrizione, cliente, metodo) => {
    const k = iso(giorno, 19 * 60);
    incomes.push({
      id: String(incomes.length + 1), data: giornoKey(giorno), importo, categoria,
      descrizione, cliente, metodo, appuntamentoId: '', createdAt: k, updatedAt: k
    });
  };
  for (let d = new Date(inizioStorico); d < piuGiorni(oggi, -14); d = piuGiorni(d, 1)) {
    if (!fasceDi(d).length) continue;
    const quanti = pesato([[1, 20], [2, 35], [3, 30], [4, 15]]);
    for (let i = 0; i < quanti; i++) {
      const tr = trattamento();
      aggiungiGuadagno(d, tr.prezzo, categoriaDi(tr.s.id, tr.aggiuntivi), tr.nome,
        nomeCliente(pesato(pesoCliente)), pesato(METODI_PESATI));
    }
    if (rnd() < 0.06) aggiungiGuadagno(d, scegli([12, 15, 18]), 'Vendita prodotti', 'Olio per cuticole', nomeCliente(pesato(pesoCliente)), 'Contanti');
    if (rnd() < 0.05) aggiungiGuadagno(d, 5, 'Mancia', '', '', 'Contanti');
  }
  /* Qualche serata da babysitter, un paio al mese. */
  for (let m = 5; m >= 0; m--) {
    [9, 23].forEach(gg => {
      const d = new Date(oggi.getFullYear(), oggi.getMonth() - m, gg);
      if (d < oggi) aggiungiGuadagno(d, scegli([40, 50, 60]), 'Babysitter', 'Serata', 'Famiglia Ferraro', scegli(['Contanti', 'Satispay']));
    });
  }

  /* Spese: mese e giorno da SPESE_SEED, mai nel futuro. */
  const expenses = SPESE_SEED.map((s, i) => {
    let d = new Date(oggi.getFullYear(), oggi.getMonth() - s.mesiFa, s.giorno);
    if (d > oggi) d = new Date(oggi);
    const k = iso(d, 12 * 60);
    return {
      id: String(i + 1), data: giornoKey(d), importo: s.importo, categoria: s.categoria,
      descrizione: s.descrizione, fornitore: s.fornitore, createdAt: k, updatedAt: k
    };
  });

  return {
    version: 1,
    settings: {
      negozi: NEGOZI_SEED.slice(),
      categorieSpese: CATEGORIE_SEED.spese.slice(),
      categorieEntrate: CATEGORIE_SEED.entrate.slice(),
      metodiPagamento: METODI_SEED.slice()
    },
    services: DEFAULT_SERVICES.map(s => Object.assign({}, s)),
    clients,
    appointments,
    expenses,
    incomes
  };
}
