// --- DOM References ---
const pantallas = document.querySelectorAll('.pantalla');
const cargarBtn = document.getElementById('cargar-cuestionario-btn');
const fileInput = document.getElementById('csv-file-input');
const codigoPartidaEl = document.getElementById('codigo-partida');
const urlSitioEl = document.getElementById('url-sitio');
const qrCodeEl = document.getElementById('qrcode');
const contadorJugadoresEl = document.getElementById('contador-jugadores');
const listaJugadoresEl = document.getElementById('lista-jugadores');
const iniciarJuegoBtn = document.getElementById('iniciar-juego-btn');
const pausaBtn = document.getElementById('pausa-btn');
const saltarTiempoBtn = document.getElementById('saltar-tiempo-btn');
const pausaOverlay = document.getElementById('pausa-overlay');
const siguientePreguntaBtn = document.getElementById('siguiente-pregunta-btn');
const reiniciarBtn = document.getElementById('reiniciar-btn');
const descargarResultadosBtn = document.getElementById('descargar-resultados-btn');
const controlesPostPregunta = document.getElementById('controles-post-pregunta');
const mostrarCorrectaBtn = document.getElementById('mostrar-correcta-btn');
const irAPuntuacionesBtn = document.getElementById('ir-a-puntuaciones-btn');
const temporizadorCirculo = document.getElementById('temporizador-circulo');
const estadoJugadoresPanel = document.getElementById('estado-jugadores-panel');
const jugadoresVotadoLista = document.getElementById('jugadores-votado');
const jugadoresPendientesLista = document.getElementById('jugadores-pendientes');
const contadorVotado = document.getElementById('contador-votado');
const contadorPendientes = document.getElementById('contador-pendientes');
const añadirJugadorBtn = document.getElementById('añadir-jugador-btn');
const reiniciarPartidaBtn = document.getElementById('reiniciar-partida-btn');
const podioEl = document.getElementById('podio');
const modalAñadirJugador = document.getElementById('modal-añadir-jugador');
const cerrarModalBtn = document.getElementById('cerrar-modal-btn');
const modalUrlSitioEl = document.getElementById('modal-url-sitio');
const modalCodigoPartidaEl = document.getElementById('modal-codigo-partida');
const modalQrCodeEl = document.getElementById('modal-qrcode');
const FULL_DASH_ARRAY = 283;

// --- State ---
let peer;
let cuestionario = [];
let jugadores = {};
let conexiones = {};
let respuestasRonda = {};
let estadoJuego = 'carga';
let preguntaActualIndex = -1;
let temporizadorInterval;
let tiempoRestante;
let tiempoPregunta;
let isPaused = false;
let gameId = '';

// --- LocalStorage Logic ---
function guardarEstadoJuego() {
    if (!gameId) return; // No guardar si no hay partida
    const jugadoresParaGuardar = {};
    for (const nombre in jugadores) {
        jugadoresParaGuardar[nombre] = {
            nombre: jugadores[nombre].nombre,
            puntaje: jugadores[nombre].puntaje,
            conectado: false,
            haVotado: jugadores[nombre].haVotado,
            correctas: jugadores[nombre].correctas,
        };
    }
    const estado = {
        gameId,
        cuestionario,
        jugadores: jugadoresParaGuardar,
        estadoJuego,
        preguntaActualIndex,
    };
    localStorage.setItem('qplay_estado_partida', JSON.stringify(estado));
}

function cargarEstadoJuego() {
    const estadoGuardado = localStorage.getItem('qplay_estado_partida');
    if (estadoGuardado) {
        try {
            const estado = JSON.parse(estadoGuardado);
            gameId = estado.gameId; // Recuperar el ID de la partida guardada
            cuestionario = estado.cuestionario;
            jugadores = estado.jugadores;
            estadoJuego = estado.estadoJuego;
            preguntaActualIndex = estado.preguntaActualIndex;
            return true;
        } catch (error) {
            console.error("Error al cargar el estado del juego:", error);
            limpiarEstadoJuego();
            return false;
        }
    }
    return false;
}

function limpiarEstadoJuego() {
    localStorage.removeItem('qplay_estado_partida');
}

// --- UI Functions ---
function mostrarPantalla(id) {
    pantallas.forEach(p => p.classList.remove('activa'));
    document.getElementById(id).classList.add('activa');
    const esPartidaActiva = (id === 'pantalla-lobby' || id === 'pantalla-pregunta' || id === 'pantalla-leaderboard' || id === 'pantalla-final');
    if(reiniciarPartidaBtn) reiniciarPartidaBtn.style.display = esPartidaActiva ? 'flex' : 'none';
    if(añadirJugadorBtn) añadirJugadorBtn.style.display = (id === 'pantalla-leaderboard' || id === 'pantalla-lobby' || id === 'pantalla-pregunta') ? 'flex' : 'none';
    
    if (id === 'pantalla-pregunta' && (estadoJuego === 'jugando' || estadoJuego === 'mostrando_correcta')) {
        estadoJugadoresPanel.style.display = 'block';
    } else {
        estadoJugadoresPanel.style.display = 'none';
    }
}

function actualizarListaJugadores() {
    if (!listaJugadoresEl) return;
    listaJugadoresEl.innerHTML = '';
    const jugadoresActivos = Object.values(jugadores).filter(j => j.conectado);
    contadorJugadoresEl.textContent = jugadoresActivos.length;
    jugadoresActivos.forEach(jugador => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between glass-card p-2 rounded-lg text-white';
        li.innerHTML = `
            <div class="flex items-center">
                <span class="font-bold text-xl">${jugador.nombre}</span>
            </div>
            <button data-peer-id="${jugador.conn.peer}" class="eliminar-jugador-btn text-red-400 hover:text-red-500 font-bold p-2 rounded-full hover:bg-red-900 hover:bg-opacity-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        `;
        listaJugadoresEl.appendChild(li);
    });
    iniciarJuegoBtn.disabled = jugadoresActivos.length === 0;
}

function actualizarEstadoJugadoresDisplay() {
    const jugadoresConectados = Object.values(jugadores).filter(j => j.conectado);
    const votado = jugadoresConectados.filter(j => j.haVotado);
    const pendientes = jugadoresConectados.filter(j => !j.haVotado);

    jugadoresVotadoLista.innerHTML = '';
    votado.forEach(j => {
        const li = document.createElement('li');
        li.textContent = j.nombre;
        jugadoresVotadoLista.appendChild(li);
    });
    contadorVotado.textContent = votado.length;

    jugadoresPendientesLista.innerHTML = '';
    pendientes.forEach(j => {
        const li = document.createElement('li');
        li.textContent = j.nombre;
        jugadoresPendientesLista.appendChild(li);
    });
    contadorPendientes.textContent = pendientes.length;
}

function mostrarModalAñadirJugador() {
    if(modalAñadirJugador) {
         modalAñadirJugador.classList.remove('hidden');
         modalAñadirJugador.classList.add('flex');
    }
}

function cerrarModalAñadirJugador() {
    if(modalAñadirJugador) {
         modalAñadirJugador.classList.add('hidden');
         modalAñadirJugador.classList.remove('flex');
    }
}

// --- Helper Functions ---
function generarCodigoCorto(longitud = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < longitud; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function reenviarEstadoActual(conn) {
    const pregunta = cuestionario[preguntaActualIndex];
    if (!pregunta) return;

    if (estadoJuego === 'jugando' || estadoJuego === 'mostrando_correcta') {
         let numRespuestasVisibles = 0;
         pregunta.respuestas.forEach((respuesta) => {
            if (respuesta.trim() !== '') numRespuestasVisibles++;
         });
        conn.send({
            tipo: 'pregunta',
            payload: {
                numRespuestas: numRespuestasVisibles,
                tipo: pregunta.tipo
            }
        });
    } else if (estadoJuego === 'leaderboard') {
        conn.send({ tipo: 'partida_iniciada' }); 
    }
}

// --- FUNCIÓN DE REINICIO MEJORADA ---
function reiniciarJuegoCompleto() {
    // 1. Destruir la conexión de red
    if (peer && !peer.destroyed) {
        peer.destroy();
    }
    // 2. Borrar los datos guardados
    limpiarEstadoJuego();
    // 3. Reiniciar las variables de estado en memoria
    cuestionario = [];
    jugadores = {};
    conexiones = {};
    respuestasRonda = {};
    estadoJuego = 'carga';
    preguntaActualIndex = -1;
    gameId = '';
    peer = null;
    // 4. Mostrar la pantalla de inicio
    mostrarPantalla('pantalla-carga');
}


// --- Game Logic ---
function iniciarJuego() {
    estadoJuego = 'jugando';
    if (document.getElementById('opcion-preguntas-aleatorias').checked) {
        for (let i = cuestionario.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cuestionario[i], cuestionario[j]] = [cuestionario[j], cuestionario[i]];
        }
    }
    preguntaActualIndex = -1;
    guardarEstadoJuego();
    avanzarPregunta();
}

function avanzarPregunta() {
    preguntaActualIndex++;
    if (preguntaActualIndex >= cuestionario.length) {
        finalizarJuego();
        return;
    }
    respuestasRonda = {};
    Object.values(jugadores).forEach(j => j.haVotado = false);
    estadoJuego = 'jugando';
    guardarEstadoJuego();
    mostrarPregunta();
    actualizarEstadoJugadoresDisplay();
}

function mostrarPregunta() {
    const pregunta = cuestionario[preguntaActualIndex];
    isPaused = false;
    pausaBtn.textContent = 'Pausar';
    pausaOverlay.style.display = 'none';
    mostrarPantalla('pantalla-pregunta');
    controlesPostPregunta.classList.add('hidden');
    mostrarCorrectaBtn.disabled = false;
    saltarTiempoBtn.style.display = 'inline-block';
    document.getElementById('contador-pregunta').textContent = `Pregunta ${preguntaActualIndex + 1} / ${cuestionario.length}`;
    document.getElementById('texto-pregunta').textContent = pregunta.pregunta;
    const imgEl = document.getElementById('imagen-pregunta');
    if (pregunta.imagen_url) {
        imgEl.src = pregunta.imagen_url;
        imgEl.classList.remove('hidden');
    } else {
        imgEl.classList.add('hidden');
    }
    const respuestasGrid = document.getElementById('respuestas-grid');
    respuestasGrid.innerHTML = '';
    const simbolos = ['▲', '◆', '●', '■'];
    let numRespuestasVisibles = 0;
    pregunta.respuestas.forEach((respuesta, index) => {
        if (respuesta.trim() !== '') {
            numRespuestasVisibles++;
            const respuestaDiv = document.createElement('div');
            respuestaDiv.className = `respuesta-color-${index} text-white p-6 rounded-lg flex items-center text-3xl text-shadow`;
            respuestaDiv.innerHTML = `<span class="mr-4 text-4xl">${simbolos[index]}</span> <p>${respuesta}</p>`;
            respuestasGrid.appendChild(respuestaDiv);
        }
    });
    tiempoPregunta = pregunta.tiempo;
    tiempoRestante = tiempoPregunta;
    const temporizadorEl = document.getElementById('temporizador');
    temporizadorEl.textContent = tiempoRestante;
    setCircleDashoffset();
    clearInterval(temporizadorInterval);
    temporizadorInterval = null;
    temporizadorInterval = setInterval(() => {
        if (isPaused) return;
        tiempoRestante--;
        temporizadorEl.textContent = tiempoRestante;
        setCircleDashoffset();
        if (tiempoRestante <= 0) {
            finalizarRonda();
        }
    }, 1000);
    Object.values(conexiones).forEach(nombre => {
        const jugador = jugadores[nombre];
        if (jugador.conectado && jugador.conn) {
            jugador.conn.send({
                tipo: 'pregunta',
                payload: {
                    numRespuestas: numRespuestasVisibles,
                    tipo: pregunta.tipo
                }
            });
        }
    });
    actualizarEstadoJugadoresDisplay();
}

function setCircleDashoffset() {
    const rawTimeFraction = tiempoRestante / tiempoPregunta;
    const dashoffset = (1 - rawTimeFraction) * FULL_DASH_ARRAY;
    temporizadorCirculo.style.strokeDashoffset = dashoffset;
}

function finalizarRonda() {
    if (temporizadorInterval) {
        clearInterval(temporizadorInterval);
        temporizadorInterval = null;
    }
    estadoJuego = 'mostrando_correcta';
    controlesPostPregunta.classList.remove('hidden');
    saltarTiempoBtn.style.display = 'none';
    const pregunta = cuestionario[preguntaActualIndex];
    Object.keys(respuestasRonda).forEach(nombre => {
        const respJugador = respuestasRonda[nombre].respuesta;
        const respCorrecta = pregunta.correcta;
        let esCorrecta = false;
        if (Array.isArray(respCorrecta)) {
            esCorrecta = respCorrecta.length === respJugador.length && respCorrecta.every(val => respJugador.includes(val));
        } else {
            esCorrecta = respCorrecta === respJugador;
        }
        if (esCorrecta) {
            jugadores[nombre].correctas = (jugadores[nombre].correctas || 0) + 1;
        }
        const puntosRonda = esCorrecta ? (500 + respuestasRonda[nombre].tiempoRespuesta * 10) : 0;
        jugadores[nombre].puntaje += puntosRonda;
        if (jugadores[nombre].conectado && jugadores[nombre].conn) {
            jugadores[nombre].conn.send({
                tipo: 'resultado',
                payload: {
                    esCorrecta: esCorrecta,
                    puntosRonda: puntosRonda,
                    puntosTotal: jugadores[nombre].puntaje
                }
            });
        }
    });
    guardarEstadoJuego();
}

function gestionarPausa() {
    isPaused = !isPaused;
    const tipoMensaje = isPaused ? 'pausa' : 'resume';
    Object.values(jugadores).forEach(j => {
        if (j.conectado && j.conn) {
            j.conn.send({
                tipo: tipoMensaje
            });
        }
    });
    if (isPaused) {
        pausaBtn.textContent = 'Reanudar';
        pausaOverlay.style.display = 'flex';
    } else {
        pausaBtn.textContent = 'Pausar';
        pausaOverlay.style.display = 'none';
    }
}

function revelarRespuestaCorrecta() {
    mostrarCorrectaBtn.disabled = true;
    const pregunta = cuestionario[preguntaActualIndex];
    const respuestasGrid = document.getElementById('respuestas-grid');
    let correctaIndices = Array.isArray(pregunta.correcta) ? pregunta.correcta : [pregunta.correcta];
    Array.from(respuestasGrid.children).forEach((el, index) => {
        if (correctaIndices.includes(index)) {
            el.classList.add('respuesta-correcta');
        }
    });
}

function mostrarLeaderboard() {
    estadoJuego = 'leaderboard';
    guardarEstadoJuego();
    mostrarPantalla('pantalla-leaderboard');
    const listaPuntuaciones = document.getElementById('lista-puntuaciones');
    listaPuntuaciones.innerHTML = '';
    const jugadoresOrdenados = Object.values(jugadores).filter(j => j.nombre).sort((a, b) => b.puntaje - a.puntaje);
    jugadoresOrdenados.forEach((jugador, index) => {
        const li = document.createElement('li');
        const medallas = ['👑', '🥈', '🥉'];
        const medalla = index < 3 ? `<span class="text-4xl mr-4">${medallas[index]}</span>` : `<span class="w-12 mr-4 text-center text-gray-300 font-semibold">${index + 1}.</span>`;
        li.className = 'flex items-center glass-card p-4 rounded-lg shadow-sm';
        li.innerHTML = `
            ${medalla}
            <span class="font-bold flex-grow">${jugador.nombre}</span>
            <span class="font-semibold text-teal-300">${jugador.puntaje} pts</span>
        `;
        listaPuntuaciones.appendChild(li);
    });
}

function finalizarJuego() {
    estadoJuego = 'final';
    mostrarPantalla('pantalla-final');
    podioEl.innerHTML = '';
    const jugadoresOrdenados = Object.values(jugadores).filter(j => j.nombre).sort((a, b) => b.puntaje - a.puntaje);
    const puntuacionMaxima = jugadoresOrdenados.length > 0 ? jugadoresOrdenados[0].puntaje : 0;
    const alturas = ['h-48', 'h-64', 'h-32'];
    const ordenPodio = [1, 0, 2];
    const medallas = ['🥈', '🥇', '🥉'];
    for (let i = 0; i < 3; i++) {
        const index = ordenPodio[i];
        const jugador = jugadoresOrdenados[index];
        if (!jugador) continue;
        const podioDiv = document.createElement('div');
        podioDiv.className = 'flex flex-col items-center';
        podioDiv.innerHTML = `
            <p class="text-4xl mb-2">${medallas[i]}</p>
            <p class="text-3xl font-bold">${jugador.nombre}</p>
            <div class="w-48 text-center p-4 rounded-t-lg ${alturas[i]} flex flex-col justify-end bg-gradient-to-t from-purple-500 to-pink-500">
                <p class="text-5xl font-extrabold">${index + 1}</p>
                <p class="text-2xl">${jugador.puntaje} pts</p>
            </div>
        `;
        podioEl.appendChild(podioDiv);
    }
    Object.values(conexiones).forEach(nombre => {
        const jugador = jugadores[nombre];
        if (jugador && jugador.conectado && jugador.conn) {
            jugador.conn.send({
                tipo: 'resultado_final',
                payload: {
                    tuPuntuacion: jugador.puntaje,
                    puntuacionMaxima: puntuacionMaxima,
                    respuestasCorrectas: jugador.correctas || 0,
                    totalPreguntas: cuestionario.length
                }
            });
        }
    });
    limpiarEstadoJuego();
}

function descargarResultados() {
    const jugadoresOrdenados = Object.values(jugadores).filter(j => j.nombre).sort((a, b) => b.puntaje - a.puntaje);
    let csvContent = 'Puesto;Nombre;Puntuacion\n';
    jugadoresOrdenados.forEach((jugador, index) => {
        const fila = `${index + 1};"${jugador.nombre}";${jugador.puntaje}`;
        csvContent += fila + '\n';
    });
    const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "resultados_partida.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- PeerJS Logic ---
function inicializarPeer(existingGameId = null) {
    if (peer) {
        peer.destroy();
    }
    gameId = existingGameId || generarCodigoCorto(5);

    const peerConfig = {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        debug: 2,
        config: {
            iceServers: [
              { urls: 'stun:stun.relay.metered.ca:80' },
              {
                urls: 'turn:standard.relay.metered.ca:80',
                username: '9745e21b303bdaea589c29bc',
                credential: 'UgG56tBqCEGNjzLY'
              },
              {
                urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
                username: '9745e21b303bdaea589c29bc',
                credential: 'UgG56tBqCEGNjzLY'
              }
            ],
            iceTransportPolicy: 'all'
        }
    };
    
    peer = new Peer(gameId, peerConfig);
    
    peer.on('open', id => {
        const urlUnion = new URL('jugador.html', window.location.href);
        if(urlSitioEl) urlSitioEl.textContent = urlUnion.origin + urlUnion.pathname;
        urlUnion.searchParams.set('partida', id);
        if(codigoPartidaEl) codigoPartidaEl.textContent = id;
        if (qrCodeEl) {
            qrCodeEl.innerHTML = "";
            new QRCode(qrCodeEl, {
                text: urlUnion.href,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
            });
        }
        // Poblar el nuevo modal
        if(modalUrlSitioEl) modalUrlSitioEl.textContent = urlUnion.origin + urlUnion.pathname;
        if(modalCodigoPartidaEl) modalCodigoPartidaEl.textContent = id;
        if (modalQrCodeEl) {
            modalQrCodeEl.innerHTML = "";
            new QRCode(modalQrCodeEl, {
                text: urlUnion.href,
                width: 320,
                height: 320,
                colorDark: "#000000",
                colorLight: "#ffffff",
            });
        }

        if (!existingGameId) {
            mostrarPantalla('pantalla-lobby');
            guardarEstadoJuego();
        }
    });
    peer.on('connection', configurarNuevaConexion);
    peer.on('error', (err) => {
        console.error("Error en PeerJS: ", err);
        if (err.type === 'unavailable-id' && existingGameId) {
            console.log("Reintentando conexión a PeerJS...");
            setTimeout(() => inicializarPeer(existingGameId), 2000);
        }
    });
}

function configurarNuevaConexion(conn) {
    conn.on('data', (data) => {
        if (data.tipo === 'join') {
            gestionarConexionJugador(conn, data.nombre);
        } else if (data.tipo === 'respuesta' && estadoJuego === 'jugando') {
            gestionarRespuestaJugador(conn.peer, data.payload);
        }
    });
    conn.on('close', () => gestionarDesconexionJugador(conn.peer));
}

function gestionarConexionJugador(conn, nombre) {
    if (Object.values(jugadores).some(j => j.nombre === nombre && j.conectado)) {
        conn.send({
            tipo: 'error',
            payload: {
                mensaje: 'Ese nombre ya está en uso.'
            }
        });
        setTimeout(() => conn.close(), 100);
        return;
    }
    let jugador = jugadores[nombre];
    if (jugador) {
        jugador.conectado = true;
        jugador.conn = conn;
    } else {
        jugador = {
            nombre: nombre,
            puntaje: 0,
            conn: conn,
            conectado: true,
            haVotado: false,
            correctas: 0
        };
        jugadores[nombre] = jugador;
    }
    conexiones[conn.peer] = nombre;
    // INVOCACIÓN A LA NUEVA LÓGICA
    if (estadoJuego === 'jugando' || estadoJuego === 'mostrando_correcta' || estadoJuego === 'leaderboard') {
        reenviarEstadoActual(jugador.conn);
    } else {
        jugador.conn.send({
            tipo: 'confirmacion_join'
        });
    }
    actualizarListaJugadores();
    actualizarEstadoJugadoresDisplay();
    guardarEstadoJuego();
}

function gestionarRespuestaJugador(peerId, payload) {
    const nombre = conexiones[peerId];
    if (!nombre || !jugadores[nombre] || jugadores[nombre].haVotado) return;
    respuestasRonda[nombre] = {
        respuesta: payload.respuesta,
        tiempoRespuesta: tiempoRestante
    };
    jugadores[nombre].haVotado = true;
    actualizarEstadoJugadoresDisplay();
    guardarEstadoJuego();
    const jugadoresActivos = Object.values(jugadores).filter(j => j.conectado).length;
    if (Object.keys(respuestasRonda).length === jugadoresActivos) {
        finalizarRonda();
    }
}

function gestionarDesconexionJugador(peerId) {
    const nombre = conexiones[peerId];
    if (nombre && jugadores[nombre]) {
        console.log(`${nombre} se ha desconectado.`);
        jugadores[nombre].conectado = false;
        jugadores[nombre].conn = null;
        delete conexiones[peerId];
        if (estadoJuego === 'carga' || estadoJuego === 'lobby') {
            actualizarListaJugadores();
        } else {
            actualizarEstadoJugadoresDisplay();
        }
    }
    guardarEstadoJuego();
}

// --- Event Listeners ---
if(cargarBtn) cargarBtn.addEventListener('click', () => {
    if (localStorage.getItem('qplay_estado_partida')) {
        if (confirm('Hay una partida en curso. ¿Quieres empezar una nueva? Se perderá el progreso anterior.')) {
            limpiarEstadoJuego();
            fileInput.click();
        }
    } else {
        fileInput.click();
    }
});

if(fileInput) fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    limpiarEstadoJuego();
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const lineas = text.split('\n').filter(l => l.trim() !== '');
        const regex = /"([^"]*)"|([^;]+)/g;
        cuestionario = [];
        for (let i = 1; i < lineas.length; i++) {
            const campos = Array.from(lineas[i].matchAll(regex), m => m[1] || m[2]);
            if (campos.length >= 8) {
                let correcta;
                const correctaRaw = campos[7] || '';
                if (correctaRaw.includes(',')) {
                    correcta = correctaRaw.split(',').map(n => parseInt(n) - 1).sort();
                } else {
                    correcta = parseInt(correctaRaw) - 1;
                }
                cuestionario.push({
                    tipo: campos[0] || 'quiz',
                    pregunta: campos[1] || '',
                    respuestas: [campos[2] || '', campos[3] || '', campos[4] || '', campos[5] || ''],
                    tiempo: parseInt(campos[6]) || 30,
                    correcta: correcta,
                    imagen_url: campos[8] || ''
                });
            }
        }
        estadoJuego = 'lobby';
        preguntaActualIndex = -1;
        jugadores = {};
        conexiones = {};
        inicializarPeer();
    };
    reader.readAsText(file);
});

if(listaJugadoresEl) listaJugadoresEl.addEventListener('click', e => {
    const boton = e.target.closest('.eliminar-jugador-btn');
    if (boton) {
        const peerId = boton.dataset.peerId;
        const nombre = conexiones[peerId];
        if (nombre && jugadores[nombre] && jugadores[nombre].conn) {
            jugadores[nombre].conn.send({
                tipo: 'expulsado'
            });
            setTimeout(() => jugadores[nombre].conn.close(), 100);
        }
        delete jugadores[nombre];
        delete conexiones[peerId];
        actualizarListaJugadores();
        guardarEstadoJuego();
    }
});

if(añadirJugadorBtn) añadirJugadorBtn.addEventListener('click', mostrarModalAñadirJugador);
if(cerrarModalBtn) cerrarModalBtn.addEventListener('click', cerrarModalAñadirJugador);
if(modalAñadirJugador) modalAñadirJugador.addEventListener('click', (e) => {
    if (e.target.id === 'modal-añadir-jugador') {
        cerrarModalAñadirJugador();
    }
});

if(iniciarJuegoBtn) iniciarJuegoBtn.addEventListener('click', iniciarJuego);
if(siguientePreguntaBtn) siguientePreguntaBtn.addEventListener('click', avanzarPregunta);
if(pausaBtn) pausaBtn.addEventListener('click', gestionarPausa);
if(saltarTiempoBtn) saltarTiempoBtn.addEventListener('click', finalizarRonda);
if(mostrarCorrectaBtn) mostrarCorrectaBtn.addEventListener('click', revelarRespuestaCorrecta);
if(irAPuntuacionesBtn) irAPuntuacionesBtn.addEventListener('click', mostrarLeaderboard);

// --- LÓGICA DE REINICIO CORREGIDA ---
if(reiniciarBtn) reiniciarBtn.addEventListener('click', () => {
    reiniciarJuegoCompleto();
});

if(reiniciarPartidaBtn) reiniciarPartidaBtn.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres reiniciar la partida? Se perderá todo el progreso actual.')) {
        reiniciarJuegoCompleto();
    }
});

if(descargarResultadosBtn) descargarResultadosBtn.addEventListener('click', descargarResultados);

window.addEventListener('beforeunload', guardarEstadoJuego);

// --- Initialization ---
function reanudarPartida() {
    console.log("Restaurando partida...");
    inicializarPeer(gameId);
    if (estadoJuego === 'lobby') {
        mostrarPantalla('pantalla-lobby');
        actualizarListaJugadores();
    } else if (estadoJuego === 'jugando' || estadoJuego === 'mostrando_correcta') {
        mostrarPregunta();
        actualizarEstadoJugadoresDisplay();
    } else if (estadoJuego === 'leaderboard') {
        mostrarLeaderboard();
    }
}
if (cargarEstadoJuego()) {
    reanudarPartida();
} else {
    mostrarPantalla('pantalla-carga');
}
