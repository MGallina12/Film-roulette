"use strict";

/* =========================================================
   CONFIGURATION SUPABASE
========================================================= */

const config = window.CINE_CONFIG;

if (
  !config ||
  !config.supabaseUrl ||
  !config.supabaseAnonKey ||
  !window.supabase
) {
  alert("La configuration Supabase est manquante ou incorrecte.");
  throw new Error("Configuration Supabase manquante.");
}

const supabaseClient = window.supabase.createClient(
  config.supabaseUrl,
  config.supabaseAnonKey
);


/* =========================================================
   ÉLÉMENTS DE LA PAGE
========================================================= */

const spaceButtons = [
  ...document.querySelectorAll(".space-button")
];

const statusTabs = [
  ...document.querySelectorAll(".status-tab")
];

const typeFilters = [
  ...document.querySelectorAll(".type-filter")
];

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const spinBtn = document.getElementById("spinBtn");

const addForm = document.getElementById("addForm");
const movieInput = document.getElementById("movieInput");
const mediaTypeInput = document.getElementById("mediaTypeInput");

const movieList = document.getElementById("movieList");
const searchInput = document.getElementById("searchInput");

const todoCount = document.getElementById("todoCount");
const watchedCount = document.getElementById("watchedCount");

const currentSpaceBadge = document.getElementById(
  "currentSpaceBadge"
);

const currentSpaceDescription = document.getElementById(
  "currentSpaceDescription"
);

const modal = document.getElementById("resultModal");
const resultMovie = document.getElementById("resultMovie");
const resultType = document.getElementById("resultType");

const closeModalButton = document.getElementById("closeModal");
const modalCloseButton = document.getElementById(
  "modalCloseButton"
);

const markWatchedButton = document.getElementById(
  "markWatched"
);

const toast = document.getElementById("toast");


/* =========================================================
   CONFIGURATION DES DEUX ESPACES
========================================================= */

/*
  Le roomId du fichier config.js reste utilisé
  pour l’espace commun.
*/

const commonRoomId =
  config.roomId || "matheo-et-sa-copine";

const commonSpaceButton = spaceButtons.find(
  button => button.dataset.spaceName === "Nous deux"
);

if (commonSpaceButton) {
  commonSpaceButton.dataset.roomId = commonRoomId;
}

const spaces = {
  common: {
    roomId: commonRoomId,
    name: "Nous deux",
    description:
      "Choisissez un film ou une série dans votre liste commune.",
    placeholder: "Ex. Interstellar",
    blueTheme: false
  },

  personal: {
    roomId: "liste-elle",
    name: "Sa liste",
    description:
      "Choisissez un film ou une série dans sa liste personnelle.",
    placeholder: "Ex. Stranger Things",
    blueTheme: true
  }
};


/* =========================================================
   PALETTES DES ROULETTES
========================================================= */

const commonPalette = [
  "#8f2942",
  "#c54b62",
  "#d59d55",
  "#6d3049",
  "#ad3b54",
  "#e1b873",
  "#7c233a",
  "#ca6a77"
];

const bluePalette = [
  "#2056b3",
  "#2e7de1",
  "#26a5d1",
  "#314d9b",
  "#4bbff0",
  "#2868c7",
  "#237fa9",
  "#526fe0"
];


/* =========================================================
   ÉTAT DE L’APPLICATION
========================================================= */

let movies = [];

let activeRoomId = commonRoomId;
let activeSpaceName = "Nous deux";

let activeTab = "todo";
let activeType = "all";

let selectedMovieId = null;
let selectedMovieRoomId = null;

let rotation = 0;
let spinning = false;
let loading = true;
let loadError = null;

let realtimeChannel = null;
let realtimeReloadTimer = null;


/* =========================================================
   OUTILS GÉNÉRAUX
========================================================= */

function normalizeMediaType(value) {
  return value === "serie" ? "serie" : "film";
}

function getMediaTypeLabel(value) {
  return normalizeMediaType(value) === "serie"
    ? "Série"
    : "Film";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
  );
}

function normalizeAngle(angle) {
  const fullTurn = Math.PI * 2;

  return (
    ((angle % fullTurn) + fullTurn) %
    fullTurn
  );
}

function findMovieById(id) {
  return movies.find(
    movie => String(movie.id) === String(id)
  );
}

function isBlueTheme() {
  return document.body.classList.contains("theme-blue");
}

function isMissingMediaTypeError(error) {
  const message = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    message.includes("media_type") &&
    (
      message.includes("column") ||
      message.includes("schema cache") ||
      error?.code === "PGRST204" ||
      error?.code === "42703"
    )
  );
}

function showSupabaseError(action, error) {
  console.error(`Erreur Supabase pendant ${action} :`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint
  });

  const message = String(error?.message || "").toLowerCase();

  if (
    error?.code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied")
  ) {
    showToast(
      "Cette liste doit encore être autorisée dans Supabase"
    );

    return;
  }

  if (isMissingMediaTypeError(error)) {
    showToast(
      "La colonne media_type doit encore être ajoutée dans Supabase"
    );

    return;
  }

  showToast(`Impossible de ${action}`);
}


/* =========================================================
   GESTION DES ESPACES
========================================================= */

function getCurrentSpace() {
  if (activeRoomId === spaces.personal.roomId) {
    return spaces.personal;
  }

  return spaces.common;
}

function applySpaceAppearance() {
  const currentSpace = getCurrentSpace();

  activeSpaceName = currentSpace.name;

  document.body.classList.toggle(
    "theme-blue",
    currentSpace.blueTheme
  );

  currentSpaceBadge.textContent =
    currentSpace.name;

  currentSpaceDescription.textContent =
    currentSpace.description;

  movieInput.placeholder =
    currentSpace.placeholder;

  spaceButtons.forEach(button => {
    const isActive =
      button.dataset.roomId === activeRoomId;

    button.classList.toggle("active", isActive);

    button.setAttribute(
      "aria-pressed",
      String(isActive)
    );
  });

  try {
    localStorage.setItem(
      "cine-roulette-active-room",
      activeRoomId
    );
  } catch (error) {
    console.warn(
      "Impossible d’enregistrer l’espace actif.",
      error
    );
  }

  drawWheel();
}

function resetFilters() {
  activeTab = "todo";
  activeType = "all";

  searchInput.value = "";

  updateFilterControls();
}

async function switchSpace(button) {
  if (spinning) {
    showToast("Attends la fin de la roulette");
    return;
  }

  const nextRoomId = button.dataset.roomId;

  if (!nextRoomId || nextRoomId === activeRoomId) {
    return;
  }

  activeRoomId = nextRoomId;

  selectedMovieId = null;
  selectedMovieRoomId = null;

  closeResultModal();
  resetFilters();
  applySpaceAppearance();

  movies = [];
  loading = true;
  loadError = null;

  updateUI();

  await subscribeToActiveRoom();
  await loadMovies();
}


/* =========================================================
   CHARGEMENT DES FILMS
========================================================= */

async function loadMovies() {
  const requestedRoomId = activeRoomId;

  loading = true;
  loadError = null;

  updateUI();

  const { data, error } = await supabaseClient
    .from("movies")
    .select("*")
    .eq("room_id", requestedRoomId)
    .order("created_at", {
      ascending: true
    });

  /*
    L’utilisateur a peut-être changé d’espace
    pendant le chargement.
  */

  if (requestedRoomId !== activeRoomId) {
    return;
  }

  loading = false;

  if (error) {
    loadError = error;
    movies = [];

    showSupabaseError(
      "charger les contenus",
      error
    );

    updateUI();
    return;
  }

  movies = (data || []).map(movie => ({
    ...movie,
    media_type: normalizeMediaType(
      movie.media_type
    )
  }));

  updateUI();
}


/* =========================================================
   AJOUTER UN FILM OU UNE SÉRIE
========================================================= */

async function addMovie(title, mediaType) {
  const normalizedTitle = normalizeText(title);

  const alreadyExists = movies.some(
    movie =>
      normalizeText(movie.title) === normalizedTitle
  );

  if (alreadyExists) {
    showToast(
      "Ce contenu est déjà présent dans la liste"
    );

    return false;
  }

  const completeRow = {
    room_id: activeRoomId,
    title,
    watched: false,
    media_type: mediaType
  };

  let { error } = await supabaseClient
    .from("movies")
    .insert(completeRow);

  /*
    Tant que la colonne media_type n’est pas créée,
    les films peuvent encore être ajoutés sans cette colonne.
    Les séries nécessiteront l’étape Supabase suivante.
  */

  if (
    error &&
    isMissingMediaTypeError(error) &&
    mediaType === "film"
  ) {
    const fallbackResult = await supabaseClient
      .from("movies")
      .insert({
        room_id: activeRoomId,
        title,
        watched: false
      });

    error = fallbackResult.error;
  }

  if (error) {
    showSupabaseError(
      "ajouter le contenu",
      error
    );

    return false;
  }

  await loadMovies();

  showToast(
    mediaType === "serie"
      ? "Série ajoutée à la liste"
      : "Film ajouté à la liste"
  );

  return true;
}


/* =========================================================
   MODIFIER L’ÉTAT D’UN CONTENU
========================================================= */

async function toggleWatched(id) {
  const movie = findMovieById(id);

  if (!movie) {
    return;
  }

  const { error } = await supabaseClient
    .from("movies")
    .update({
      watched: !movie.watched
    })
    .eq("id", movie.id)
    .eq("room_id", activeRoomId);

  if (error) {
    showSupabaseError(
      "modifier le contenu",
      error
    );

    return;
  }

  await loadMovies();

  showToast(
    movie.watched
      ? "Remis dans les contenus à regarder"
      : "Ajouté aux contenus déjà regardés"
  );
}


/* =========================================================
   SUPPRIMER UN CONTENU
========================================================= */

async function removeMovie(id) {
  const movie = findMovieById(id);

  if (!movie) {
    return;
  }

  const confirmation = confirm(
    `Supprimer « ${movie.title} » ?`
  );

  if (!confirmation) {
    return;
  }

  const { error } = await supabaseClient
    .from("movies")
    .delete()
    .eq("id", movie.id)
    .eq("room_id", activeRoomId);

  if (error) {
    showSupabaseError(
      "supprimer le contenu",
      error
    );

    return;
  }

  await loadMovies();
  showToast("Contenu supprimé");
}


/* =========================================================
   MISE À JOUR DE L’INTERFACE
========================================================= */

function updateUI() {
  const todoMovies = movies.filter(
    movie => !movie.watched
  );

  const watchedMovies = movies.filter(
    movie => movie.watched
  );

  todoCount.textContent = todoMovies.length;
  watchedCount.textContent = watchedMovies.length;

  spinBtn.disabled =
    loading ||
    spinning ||
    todoMovies.length === 0;

  renderList();
  drawWheel();
}

function updateFilterControls() {
  statusTabs.forEach(tab => {
    const isActive =
      tab.dataset.tab === activeTab;

    tab.classList.toggle("active", isActive);

    tab.setAttribute(
      "aria-selected",
      String(isActive)
    );
  });

  typeFilters.forEach(button => {
    const isActive =
      button.dataset.type === activeType;

    button.classList.toggle("active", isActive);

    button.setAttribute(
      "aria-pressed",
      String(isActive)
    );
  });
}


/* =========================================================
   AFFICHAGE DE LA LISTE
========================================================= */

function renderList() {
  if (loading) {
    movieList.innerHTML = `
      <div class="empty-state">
        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◌
        </span>

        <p>Chargement de la liste…</p>
      </div>
    `;

    return;
  }

  if (loadError) {
    movieList.innerHTML = `
      <div class="empty-state">
        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          !
        </span>

        <p>
          Impossible de charger la liste.
        </p>
      </div>
    `;

    return;
  }

  const query = normalizeText(searchInput.value);

  const filteredMovies = movies
    .filter(movie => {
      if (activeTab === "todo") {
        return !movie.watched;
      }

      return movie.watched;
    })
    .filter(movie => {
      if (activeType === "all") {
        return true;
      }

      return (
        normalizeMediaType(movie.media_type) ===
        activeType
      );
    })
    .filter(movie => {
      if (!query) {
        return true;
      }

      return normalizeText(movie.title).includes(
        query
      );
    });

  if (filteredMovies.length === 0) {
    let message;

    if (query) {
      message = "Aucun résultat pour cette recherche.";
    } else if (activeType !== "all") {
      message =
        activeType === "serie"
          ? "Aucune série dans cette catégorie."
          : "Aucun film dans cette catégorie.";
    } else if (activeTab === "watched") {
      message =
        "Aucun contenu regardé pour le moment.";
    } else {
      message =
        "La liste est vide. Ajoutez un film ou une série.";
    }

    movieList.innerHTML = `
      <div class="empty-state">
        <span
          class="empty-state-icon"
          aria-hidden="true"
        >
          ◌
        </span>

        <p>${message}</p>
      </div>
    `;

    return;
  }

  movieList.innerHTML = filteredMovies
    .map((movie, index) => {
      const title = escapeHtml(movie.title);

      const typeLabel = getMediaTypeLabel(
        movie.media_type
      );

      const actionLabel = movie.watched
        ? "Remettre à regarder"
        : "Marquer comme regardé";

      return `
        <article class="movie">
          <div class="movie-number">
            ${index + 1}
          </div>

          <div class="movie-copy">
            <div
              class="movie-title"
              title="${title}"
            >
              ${title}
            </div>

            <div class="movie-meta">
              ${typeLabel}
            </div>
          </div>

          <div class="movie-actions">
            <button
              class="icon-btn"
              type="button"
              data-action="toggle"
              data-id="${escapeHtml(movie.id)}"
              title="${actionLabel}"
              aria-label="${actionLabel} : ${title}"
            >
              ${movie.watched ? "↩" : "✓"}
            </button>

            <button
              class="icon-btn"
              type="button"
              data-action="delete"
              data-id="${escapeHtml(movie.id)}"
              title="Supprimer"
              aria-label="Supprimer : ${title}"
            >
              ×
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}


/* =========================================================
   DESSIN DE LA ROULETTE
========================================================= */

function getWheelItems() {
  return movies.filter(
    movie => !movie.watched
  );
}

function getWheelPalette() {
  return isBlueTheme()
    ? bluePalette
    : commonPalette;
}

function drawEmptyWheel(message) {
  const width = canvas.width;
  const height = canvas.height;

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * 0.45;

  ctx.clearRect(0, 0, width, height);

  ctx.beginPath();
  ctx.arc(
    centerX,
    centerY,
    radius,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = isBlueTheme()
    ? "#10223d"
    : "#28161d";

  ctx.fill();

  ctx.strokeStyle = isBlueTheme()
    ? "rgba(117, 194, 255, 0.25)"
    : "rgba(241, 205, 156, 0.22)";

  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = isBlueTheme()
    ? "#9bb5cf"
    : "#bca6aa";

  ctx.font = "700 36px DM Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    message,
    centerX,
    centerY
  );
}

function drawWheel() {
  const items = getWheelItems();

  if (loading) {
    drawEmptyWheel("Chargement…");
    return;
  }

  if (!items.length) {
    drawEmptyWheel("Ajoutez un contenu");
    return;
  }

  const palette = getWheelPalette();

  const width = canvas.width;
  const height = canvas.height;

  const centerX = width / 2;
  const centerY = height / 2;

  const radius = width * 0.45;
  const arc = (Math.PI * 2) / items.length;

  ctx.clearRect(0, 0, width, height);

  ctx.save();

  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);

  items.forEach((movie, index) => {
    const startAngle =
      index * arc - Math.PI / 2;

    const endAngle =
      startAngle + arc;

    ctx.beginPath();
    ctx.moveTo(0, 0);

    ctx.arc(
      0,
      0,
      radius,
      startAngle,
      endAngle
    );

    ctx.closePath();

    ctx.fillStyle =
      palette[index % palette.length];

    ctx.fill();

    ctx.strokeStyle =
      "rgba(255, 255, 255, 0.18)";

    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();

    ctx.rotate(
      startAngle + arc / 2
    );

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#ffffff";

    const fontSize =
      items.length > 28
        ? 15
        : items.length > 20
          ? 18
          : items.length > 12
            ? 23
            : 29;

    ctx.font =
      `800 ${fontSize}px DM Sans, sans-serif`;

    const maxCharacters =
      items.length > 28
        ? 11
        : items.length > 20
          ? 14
          : items.length > 12
            ? 18
            : 24;

    const title = String(movie.title);

    const label =
      title.length > maxCharacters
        ? `${title.slice(
            0,
            maxCharacters - 1
          )}…`
        : title;

    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 5;

    ctx.fillText(
      label,
      radius - 30,
      0
    );

    ctx.restore();
  });

  ctx.restore();

  /*
    Bordure extérieure.
  */

  ctx.beginPath();

  ctx.arc(
    centerX,
    centerY,
    radius,
    0,
    Math.PI * 2
  );

  ctx.strokeStyle = isBlueTheme()
    ? "rgba(161, 220, 255, 0.35)"
    : "rgba(243, 211, 157, 0.35)";

  ctx.lineWidth = 7;
  ctx.stroke();

  /*
    Centre de la roue.
  */

  ctx.beginPath();

  ctx.arc(
    centerX,
    centerY,
    radius * 0.16,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = isBlueTheme()
    ? "#081528"
    : "#1a0e13";

  ctx.fill();

  ctx.strokeStyle = isBlueTheme()
    ? "rgba(126, 203, 255, 0.42)"
    : "rgba(241, 205, 156, 0.4)";

  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 34px DM Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    "GO",
    centerX,
    centerY + 2
  );
}


/* =========================================================
   LANCEMENT DE LA ROULETTE
========================================================= */

function spin() {
  const items = getWheelItems();

  if (
    !items.length ||
    spinning ||
    loading
  ) {
    return;
  }

  spinning = true;
  spinBtn.disabled = true;

  const winnerIndex = Math.floor(
    Math.random() * items.length
  );

  const fullTurn = Math.PI * 2;
  const arc = fullTurn / items.length;

  const desiredRotation = normalizeAngle(
    -(winnerIndex * arc + arc / 2)
  );

  const currentRotation =
    normalizeAngle(rotation);

  const adjustment =
    (
      desiredRotation -
      currentRotation +
      fullTurn
    ) % fullTurn;

  const extraTurns =
    (
      6 +
      Math.floor(Math.random() * 3)
    ) * fullTurn;

  const startRotation = rotation;

  const targetRotation =
    startRotation +
    extraTurns +
    adjustment;

  const duration = 4200;
  const startTime = performance.now();

  function animate(currentTime) {
    const progress = Math.min(
      (currentTime - startTime) / duration,
      1
    );

    const easedProgress =
      1 - Math.pow(1 - progress, 4);

    rotation =
      startRotation +
      (
        targetRotation -
        startRotation
      ) * easedProgress;

    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    rotation = normalizeAngle(
      targetRotation
    );

    spinning = false;

    const winner = items[winnerIndex];

    selectedMovieId = winner.id;
    selectedMovieRoomId = activeRoomId;

    openResultModal(winner);
    updateUI();
  }

  requestAnimationFrame(animate);
}


/* =========================================================
   FENÊTRE DU RÉSULTAT
========================================================= */

function openResultModal(movie) {
  resultMovie.textContent = movie.title;

  resultType.textContent =
    getMediaTypeLabel(movie.media_type);

  modal.classList.add("show");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  setTimeout(() => {
    markWatchedButton.focus();
  }, 100);
}

function closeResultModal() {
  modal.classList.remove("show");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  selectedMovieId = null;
  selectedMovieRoomId = null;
}

async function markSelectedMovieAsWatched() {
  if (
    selectedMovieId === null ||
    selectedMovieRoomId === null
  ) {
    return;
  }

  markWatchedButton.disabled = true;

  const { error } = await supabaseClient
    .from("movies")
    .update({
      watched: true
    })
    .eq("id", selectedMovieId)
    .eq("room_id", selectedMovieRoomId);

  markWatchedButton.disabled = false;

  if (error) {
    showSupabaseError(
      "déplacer le contenu",
      error
    );

    return;
  }

  closeResultModal();
  await loadMovies();

  showToast(
    "Contenu déplacé dans les contenus regardés"
  );
}


/* =========================================================
   MESSAGES TEMPORAIRES
========================================================= */

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}


/* =========================================================
   SUPABASE REALTIME
========================================================= */

function scheduleRealtimeReload() {
  clearTimeout(realtimeReloadTimer);

  realtimeReloadTimer = setTimeout(() => {
    loadMovies();
  }, 150);
}

async function subscribeToActiveRoom() {
  if (realtimeChannel) {
    await supabaseClient.removeChannel(
      realtimeChannel
    );

    realtimeChannel = null;
  }

  const subscribedRoomId = activeRoomId;

  realtimeChannel = supabaseClient
    .channel(
      `movies-${subscribedRoomId}-${Date.now()}`
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "movies",
        filter:
          `room_id=eq.${subscribedRoomId}`
      },
      () => {
        /*
          Ignore les événements d’un ancien espace.
        */

        if (
          subscribedRoomId !== activeRoomId
        ) {
          return;
        }

        scheduleRealtimeReload();
      }
    )
    .subscribe(status => {
      console.log(
        `Realtime ${subscribedRoomId} :`,
        status
      );
    });
}


/* =========================================================
   ÉVÉNEMENTS DE NAVIGATION
========================================================= */

spaceButtons.forEach(button => {
  button.addEventListener(
    "click",
    async () => {
      await switchSpace(button);
    }
  );
});


/* =========================================================
   ÉVÉNEMENTS DES FILTRES
========================================================= */

statusTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;

    updateFilterControls();
    renderList();
  });
});

typeFilters.forEach(button => {
  button.addEventListener("click", () => {
    activeType = button.dataset.type;

    updateFilterControls();
    renderList();
  });
});

searchInput.addEventListener(
  "input",
  renderList
);


/* =========================================================
   ÉVÉNEMENT DU FORMULAIRE
========================================================= */

addForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const title = movieInput.value.trim();

    const mediaType =
      normalizeMediaType(
        mediaTypeInput.value
      );

    if (!title) {
      return;
    }

    const submitButton =
      addForm.querySelector(
        'button[type="submit"]'
      );

    submitButton.disabled = true;

    const success = await addMovie(
      title,
      mediaType
    );

    submitButton.disabled = false;

    if (!success) {
      return;
    }

    movieInput.value = "";

    activeTab = "todo";
    activeType = "all";

    updateFilterControls();
    movieInput.focus();
  }
);


/* =========================================================
   ACTIONS DANS LA LISTE
========================================================= */

movieList.addEventListener(
  "click",
  async event => {
    const button = event.target.closest(
      "button[data-action]"
    );

    if (!button) {
      return;
    }

    const id = button.dataset.id;
    const action = button.dataset.action;

    button.disabled = true;

    if (action === "toggle") {
      await toggleWatched(id);
    }

    if (action === "delete") {
      await removeMovie(id);
    }

    button.disabled = false;
  }
);


/* =========================================================
   ÉVÉNEMENTS DE LA ROULETTE ET DE LA MODALE
========================================================= */

spinBtn.addEventListener(
  "click",
  spin
);

closeModalButton.addEventListener(
  "click",
  closeResultModal
);

modalCloseButton.addEventListener(
  "click",
  closeResultModal
);

markWatchedButton.addEventListener(
  "click",
  markSelectedMovieAsWatched
);

modal.addEventListener(
  "click",
  event => {
    if (event.target === modal) {
      closeResultModal();
    }
  }
);

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Escape" &&
      modal.classList.contains("show")
    ) {
      closeResultModal();
    }
  }
);


/* =========================================================
   INITIALISATION
========================================================= */

async function initializeApp() {
  let savedRoomId = null;

  try {
    savedRoomId = localStorage.getItem(
      "cine-roulette-active-room"
    );
  } catch (error) {
    console.warn(
      "Impossible de récupérer l’espace précédent.",
      error
    );
  }

  const savedButton = spaceButtons.find(
    button =>
      button.dataset.roomId === savedRoomId
  );

  const initiallyActiveButton =
    savedButton ||
    spaceButtons.find(
      button =>
        button.classList.contains("active")
    ) ||
    spaceButtons[0];

  if (initiallyActiveButton) {
    activeRoomId =
      initiallyActiveButton.dataset.roomId;
  }

  applySpaceAppearance();
  updateFilterControls();
  updateUI();

  await subscribeToActiveRoom();
  await loadMovies();
}

initializeApp();
