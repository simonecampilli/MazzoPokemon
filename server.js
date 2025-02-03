// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serviamo i file statici dalla cartella "public"
app.use(express.static('public'));

/* ===== Mazzo Eventi (pubblico) ===== */
let eventDeck = [
  { text: "EVENTO: PESCA 3 CARTE STRUMENTO" },
  { text: "EVENTO: PESCA 3 CARTE STRUMENTO" },
  { text: "EVENTO: PESCA 3 CARTE STRUMENTO" },
  { text: "EVENTO: PESCA 2 CARTE STRUMENTO" },
  { text: "EVENTO: PESCA 2 CARTE STRUMENTO" },
  { text: "EVENTO: PESCA 2 CARTE STRUMENTO" },
  { text: "EVENTO: PESCA 2 CARTE STRUMENTO" },
  { text: "EVENTO: PICK ESOTICO (opzionale) – Lancia e incontra un Legendary" },
  { text: "EVENTO: PICK ESOTICO (opzionale) – Lancia e incontra un Legendary" },
  { text: "EVENTO: PESCA 1 CARTA STRUMENTO" },
  { text: "EVENTO: PESCA 1 CARTA STRUMENTO" },
  { text: "EVENTO: PESCA 1 CARTA STRUMENTO" },
  { text: "EVENTO: SCAMBIO – Pokémon e/o Oggetti di rarità uguale" },
  { text: "EVENTO: SCAMBIO – Pokémon e/o Oggetti di rarità uguale" },
  { text: "EVENTO: SCAMBIO – Pokémon e/o Oggetti di rarità uguale" },
  { text: "EVENTO: RIPRISTINA LA SQUADRA POKÉMON" },
  { text: "EVENTO: RIPRISTINA LA SQUADRA POKÉMON" },
  { text: "EVENTO: SCEGLI SE SFIDARE UN ALTRO GIOCATORE" },
  { text: "EVENTO: SCEGLI SE SFIDARE UN ALTRO GIOCATORE" }
];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
eventDeck = shuffle(eventDeck);
let eventDiscardPile = [];

/* ===== Mazzo Strumenti ===== */
// Popoliamo il mazzo strumenti secondo le nuove specifiche
let instrumentDeck = [];
function addCards(cardObj, qty) {
  for (let i = 0; i < qty; i++) {
    instrumentDeck.push(cardObj);
  }
}

// Carte "Pozione" e "Super Pozione"
addCards({ text: "STRUMENTO: POZIONE\n«Metti in sesto un Pokémon»" }, 8);
addCards({ text: "STRUMENTO: SUPER POZIONE\n«Metti in sesto la tua squadra»" }, 6);

// Carte "Volo"
addCards({ text: "STRUMENTO: VOLO\n«Viaggia in una palestra a scelta»" }, 3);

// Carte per Aumentare l'attacco
addCards({ text: "STRUMENTO: AUMENTA IL TUO ATTACCO DI +1" }, 2);
addCards({ text: "STRUMENTO: AUMENTA IL TUO ATTACCO DI +2" }, 2);
addCards({ text: "STRUMENTO: AUMENTA IL TUO ATTACCO DI +3" }, 4);
addCards({ text: "STRUMENTO: AUMENTA IL TUO ATTACCO DI +5" }, 2);

// Carte Poké Ball, Mega Ball, Ultra Ball e Master Ball
addCards({ text: "STRUMENTO: POKÉ-BALL\n«Scegli se usare il bonus alla cattura: +1 / +2»" }, 6);
addCards({ text: "STRUMENTO: MEGA-BALL\n«Scegli se usare il bonus alla cattura: +1 / +1»" }, 7);
addCards({ text: "STRUMENTO: ULTRA-BALL\n«Scegli se usare il bonus alla cattura: +1 / +2»" }, 6);
addCards({ text: "STRUMENTO: MASTER-BALL\n«Scegli se usare il bonus alla cattura: +1 / +2 / +3»" }, 4);

instrumentDeck = shuffle(instrumentDeck);

// Ogni utente (socket) ha una mano privata per le carte strumenti
let instrumentHands = {};  
let instrumentDiscardPile = [];

io.on('connection', (socket) => {
  console.log(`Utente connesso: ${socket.id}`);
  
  // Inizializza la mano strumenti per questo utente (vuota all'inizio)
  instrumentHands[socket.id] = [];
  
  // Invia lo stato iniziale per il mazzo eventi
  socket.emit('updateState', { deckCount: eventDeck.length, discardPile: eventDiscardPile });
  // Invia lo stato iniziale per il mazzo strumenti (conteggio) e la mano (vuota)
  socket.emit('updateInstrumentDeckCount', { deckCount: instrumentDeck.length });
  socket.emit('updateInstrumentHand', { hand: instrumentHands[socket.id] });
  // Invia lo stato iniziale degli scarti strumenti
  socket.emit('updateInstrumentDiscard', { discardPile: instrumentDiscardPile });
  
  /* ----- Gestione Mazzo Eventi ----- */
  socket.on('drawCard', () => {
    if (eventDeck.length > 0) {
      const card = eventDeck.pop();
      eventDiscardPile.push(card);
      io.emit('cardDrawn', { card, deckCount: eventDeck.length });
    } else {
      socket.emit('deckEmpty');
    }
  });
  
  /* ----- Gestione Mazzo Strumenti ----- */
  socket.on('drawInstrumentCard', () => {
    if (instrumentHands[socket.id].length >= 7) {
      socket.emit('handFull', { message: "Hai già 7 carte in mano!" });
      return;
    }
    if (instrumentDeck.length > 0) {
      const card = instrumentDeck.pop();
      instrumentHands[socket.id].push(card);
      socket.emit('instrumentCardDrawn', { card, hand: instrumentHands[socket.id], deckCount: instrumentDeck.length });
      io.emit('updateInstrumentDeckCount', { deckCount: instrumentDeck.length });
    } else {
      socket.emit('instrumentDeckEmpty');
    }
  });
  
  // Quando un utente usa una carta dalla propria mano strumenti
  socket.on('useInstrumentCard', (data) => {
    const index = data.index;
    if (instrumentHands[socket.id] && instrumentHands[socket.id].length > index) {
      const usedCard = instrumentHands[socket.id].splice(index, 1)[0];
      instrumentDiscardPile.push(usedCard);
      socket.emit('updateInstrumentHand', { hand: instrumentHands[socket.id] });
      io.emit('instrumentCardUsed', { card: usedCard });
    }
  });
  
  // Reset dei mazzi tramite pulsanti: rimetto insieme gli scarti
  socket.on('resetEventDiscard', () => {
    eventDeck = shuffle(eventDeck.concat(eventDiscardPile));
    eventDiscardPile = [];
    io.emit('updateState', { deckCount: eventDeck.length, discardPile: eventDiscardPile });
  });
  
  socket.on('resetInstrumentDiscard', () => {
    instrumentDeck = shuffle(instrumentDeck.concat(instrumentDiscardPile));
    instrumentDiscardPile = [];
    io.emit('updateInstrumentDeckCount', { deckCount: instrumentDeck.length });
    io.emit('updateInstrumentDiscard', { discardPile: instrumentDiscardPile });
  });
  
  socket.on('disconnect', () => {
    console.log(`Utente disconnesso: ${socket.id}`);
    delete instrumentHands[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});
