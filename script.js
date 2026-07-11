const defaultMovies = [
  { title: "Green book", watched: true },
  { title: "Exit 8", watched: false },
  { title: "The gentleman (2019)", watched: false },
  { title: "Zootopia 2 (Disney)", watched: true },
  { title: "Il était une fois (Disney)", watched: true },
  { title: "Anastasia (Disney)", watched: false },
  { title: "One piece live action (Netflix)", watched: false },
  { title: "Le dragon des mers", watched: true },
  { title: "Running Man", watched: false },
  { title: "Time out", watched: false },
  { title: "Kong", watched: false },
  { title: "Godzilla", watched: false },
  { title: "Bad boys", watched: false },
  { title: "Real steel", watched: true },
  { title: "The Ron Clark Story", watched: true },
  { title: "Kong Fu panda 2", watched: true },
  { title: "Kong Fu panda 3", watched: false },
  { title: "Jumper (Disney)", watched: true },
  { title: "Road house", watched: false },
  { title: "Marty Supreme", watched: false },
  { title: "L'immortel", watched: false },
  { title: "Freedom writers", watched: false },
  { title: "Seven", watched: false },
  { title: "Le grand bleu", watched: false },
  { title: "Léon", watched: false },
  { title: "Pretty woman", watched: true },
  { title: "Robin des Bois", watched: true },
  { title: "The Bodyguard", watched: false },
  { title: "Dirty dancing", watched: false },
  { title: "Jurassic park", watched: false },
  { title: "Retour vers le futur", watched: false },
  { title: "James bond", watched: false },
  { title: "Et si c'était vrai", watched: false },
  { title: "La nuit au musée", watched: false },
  { title: "Rrrrrhhh", watched: false },
  { title: "Hitman : agent 47", watched: false },
  { title: "Idiocracy", watched: false }
];

let movies = [];
let activeTab = "todo";
let selectedMovieId = null;
let rotation = 0;
let spinning = false;

const config = window.CINE_CONFIG;

if (
  !config ||
  !config.supabaseUrl ||
  !config.supabaseAnonKey ||
  config.supabaseUrl.includes("COLLE_ICI") ||
  config.supabaseAnonKey.includes("COLLE_ICI")
) {
  alert("Le fichier config.js n'est pas correctement configuré.");
  throw new Error("Configuration Supabase manquante.");
}

const supabaseClient = window.supabase.createClient(
  config.supabaseUrl,
  config.supabaseAnonKey
);

const roomId = config.roomId || "matheo-et-sa-copine";

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const movieList = document.getElementById("movieList");
const todoCount = document.getElementById("todoCount");
const watchedCount = document.getElementById("watchedCount");
const searchInput = document.getElementById("searchInput");
const modal = document.getElementById("resultModal");
const resultMovie = document.getElementById("resultMovie");
const toast = document.getElementById("toast");

const palette = [
  "#ff5b7f",
  "#8d6bff",
  "#38bdf8",
  "#f59e0b",
  "#34d399",
  "#fb7185",
  "#a78bfa",
  "#22d3ee"
];

async function loadMovies() {
  const { data, error } = await supabaseClient
    .from("movies")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erreur de chargement :", error);
    showToast("Impossible de charger les films");
    return;
  }

  movies = data || [];

  if (movies.length === 0) {
    await addDefaultMovies();
    return;
  }

  updateUI();
}

async function addDefaultMovies() {
  const rows = defaultMovies.map(movie => ({
    room_id: roomId,
    title: movie.title,
    watched: movie.watched
  }));

  const { error } = await supabaseClient
    .from("movies")
    .insert(rows);

  if (error) {
    console.error("Erreur d'initialisation :", error);
    showToast("Impossible d'ajouter la liste de départ");
    return;
  }

  await loadMovies();
}

async function addMovie(title) {
  const { error } = await supabaseClient
    .from("movies")
    .insert({
      room_id: roomId,
      title,
      watched: false
    });

  if (error) {
    console.error("Erreur d'ajout :", error);
    showToast("Impossible d'ajouter le film");
    return;
  }

  showToast("Film ajouté à la roue");
}

async function toggleWatched(id) {
  const movie = movies.find(item => item.id === id);

  if (!movie) return;

  const { error } = await supabaseClient
    .from("movies")
    .update({
      watched: !movie.watched
    })
    .eq("id", id)
    .eq("room_id", roomId);

  if (error) {
    console.error("Erreur de modification :", error);
    showToast("Impossible de modifier le film");
    return;
  }

  showToast("Liste mise à jour");
}

async function removeMovie(id) {
  const movie = movies.find(item => item.id === id);

  if (!movie) return;

  const confirmation = confirm(`Supprimer « ${movie.title} » ?`);

  if (!confirmation) return;

  const { error } = await supabaseClient
    .from("movies")
    .delete()
    .eq("id", id)
    .eq("room_id", roomId);

  if (error) {
    console.error("Erreur de suppression :", error);
    showToast("Impossible de supprimer le film");
    return;
  }

  showToast("Film supprimé");
}

window.toggleWatched = toggleWatched;
window.removeMovie = removeMovie;

function updateUI() {
  todoCount.textContent = movies.filter(movie => !movie.watched).length;
  watchedCount.textContent = movies.filter(movie => movie.watched).length;

  spinBtn.disabled =
    movies.filter(movie => !movie.watched).length === 0 || spinning;

  renderList();
  drawWheel();
}

function renderList() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = movies
    .filter(movie =>
      activeTab === "todo" ? !movie.watched : movie.watched
    )
    .filter(movie =>
      movie.title.toLowerCase().includes(query)
    );

  if (!filtered.length) {
    movieList.innerHTML = `
      <div class="empty">
        ${
          query
            ? "Aucun film trouvé."
            : activeTab === "todo"
              ? "La liste est vide. Ajoutez un film !"
              : "Aucun film regardé pour le moment."
        }
      </div>
    `;

    return;
  }

  movieList.innerHTML = filtered
    .map(
      (movie, index) => `
        <div class="movie">
          <div class="movie-number">${index + 1}</div>

          <div
            class="movie-title"
            title="${escapeHtml(movie.title)}"
          >
            ${escapeHtml(movie.title)}
          </div>

          <div class="movie-actions">
            <button
              class="icon-btn"
              title="${
                movie.watched
                  ? "Remettre à regarder"
                  : "Marquer comme regardé"
              }"
              onclick="toggleWatched(${movie.id})"
            >
              ${movie.watched ? "↩" : "✓"}
            </button>

            <button
              class="icon-btn"
              title="Supprimer"
              onclick="removeMovie(${movie.id})"
            >
              ×
            </button>
          </div>
        </div>
      `
    )
    .join("");
}

function drawWheel() {
  const items = movies.filter(movie => !movie.watched);

  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * 0.45;

  ctx.clearRect(0, 0, width, height);

  if (!items.length) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#2a2535";
    ctx.fill();

    ctx.fillStyle = "#aaa3b9";
    ctx.font = "700 40px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ajoutez un film", centerX, centerY);

    return;
  }

  const arc = (Math.PI * 2) / items.length;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);

  items.forEach((movie, index) => {
    const start = index * arc - Math.PI / 2;
    const end = start + arc;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();

    ctx.fillStyle = palette[index % palette.length];
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + arc / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";

    const fontSize =
      items.length > 20 ? 18 : items.length > 12 ? 24 : 31;

    ctx.font = `800 ${fontSize}px Inter, sans-serif`;

    const maxCharacters =
      items.length > 20 ? 15 : items.length > 12 ? 19 : 25;

    const label =
      movie.title.length > maxCharacters
        ? `${movie.title.slice(0, maxCharacters - 1)}…`
        : movie.title;

    ctx.fillText(label, radius - 32, 9);
    ctx.restore();
  });

  ctx.restore();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "#181520";
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,.25)";
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "900 34px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GO", centerX, centerY + 12);
}

function spin() {
  const items = movies.filter(movie => !movie.watched);

  if (!items.length || spinning) return;

  spinning = true;
  spinBtn.disabled = true;

  const winnerIndex = Math.floor(Math.random() * items.length);
  const arc = (Math.PI * 2) / items.length;
  const target = -(winnerIndex * arc + arc / 2);
  const extraTurns =
    (6 + Math.floor(Math.random() * 3)) * Math.PI * 2;

  const startRotation = rotation;
  const targetRotation = target + extraTurns;
  const duration = 4200;
  const startTime = performance.now();

  function animate(now) {
    const time = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - time, 4);

    rotation =
      startRotation +
      (targetRotation - startRotation) * eased;

    drawWheel();

    if (time < 1) {
      requestAnimationFrame(animate);
      return;
    }

    rotation =
      ((rotation % (Math.PI * 2)) + Math.PI * 2) %
      (Math.PI * 2);

    spinning = false;
    selectedMovieId = items[winnerIndex].id;
    resultMovie.textContent = items[winnerIndex].title;
    modal.classList.add("show");

    updateUI();
  }

  requestAnimationFrame(animate);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function escapeHtml(value) {
  return value.replace(
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

document
  .getElementById("addForm")
  .addEventListener("submit", async event => {
    event.preventDefault();

    const input = document.getElementById("movieInput");
    const title = input.value.trim();

    if (!title) return;

    const alreadyExists = movies.some(
      movie =>
        movie.title.toLowerCase() === title.toLowerCase()
    );

    if (alreadyExists) {
      showToast("Ce film est déjà dans la liste");
      return;
    }

    input.value = "";
    activeTab = "todo";

    document.querySelectorAll(".tab").forEach(tab => {
      tab.classList.toggle(
        "active",
        tab.dataset.tab === "todo"
      );
    });

    await addMovie(title);
  });

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;

    document.querySelectorAll(".tab").forEach(otherTab => {
      otherTab.classList.toggle(
        "active",
        otherTab === tab
      );
    });

    renderList();
  });
});

searchInput.addEventListener("input", renderList);
spinBtn.addEventListener("click", spin);

document
  .getElementById("closeModal")
  .addEventListener("click", () => {
    modal.classList.remove("show");
  });

document
  .getElementById("markWatched")
  .addEventListener("click", async () => {
    if (selectedMovieId === null) return;

    const { error } = await supabaseClient
      .from("movies")
      .update({
        watched: true
      })
      .eq("id", selectedMovieId)
      .eq("room_id", roomId);

    if (error) {
      console.error("Erreur de modification :", error);
      showToast("Impossible de déplacer le film");
      return;
    }

    selectedMovieId = null;
    modal.classList.remove("show");
    showToast("Film déplacé dans les films regardés");
  });

modal.addEventListener("click", event => {
  if (event.target === modal) {
    modal.classList.remove("show");
  }
});

const realtimeChannel = supabaseClient
  .channel(`movies-${roomId}`)
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "movies",
      filter: `room_id=eq.${roomId}`
    },
    () => {
      loadMovies();
    }
  )
  .subscribe(status => {
    console.log("État Supabase Realtime :", status);
  });

loadMovies();
