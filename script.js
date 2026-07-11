const defaultMovies = [
      {title:"Green book", watched:true},
      {title:"Exit 8", watched:false},
      {title:"The gentleman (2019)", watched:false},
      {title:"Zootopia 2 (Disney)", watched:true},
      {title:"Il était une fois (Disney)", watched:true},
      {title:"Anastasia (Disney)", watched:false},
      {title:"One piece live action (Netflix)", watched:false},
      {title:"Le dragon des mers", watched:true},
      {title:"Running Man", watched:false},
      {title:"Time out", watched:false},
      {title:"Kong", watched:false},
      {title:"Godzilla", watched:false},
      {title:"Bad boys", watched:false},
      {title:"Real steel", watched:true},
      {title:"The Ron Clark Story", watched:true},
      {title:"Kong Fu panda 2", watched:true},
      {title:"Kong Fu panda 3", watched:false},
      {title:"Jumper (Disney)", watched:true},
      {title:"Road house", watched:false},
      {title:"Marty Supreme", watched:false},
      {title:"L'immortel", watched:false},
      {title:"Freedom writers", watched:false},
      {title:"Seven", watched:false},
      {title:"Le grand bleu", watched:false},
      {title:"Exit 8", watched:false},
      {title:"Léon", watched:false},
      {title:"Pretty woman", watched:true},
      {title:"Robin des Bois", watched:true},
      {title:"The Bodyguard", watched:false},
      {title:"Dirty dancing", watched:false},
      {title:"Jurassic park", watched:false},
      {title:"Retour vers le futur", watched:false},
      {title:"James bond", watched:false},
      {title:"Et si c'était vrai", watched:false},
      {title:"La nuit au musée", watched:false},
      {title:"Rrrrrhhh", watched:false},
      {title:"Hitman : agent 47", watched:false},
      {title:"Idiocracy", watched:false}
    ].map((movie, index) => ({...movie, id: Date.now() + index}));

    let movies = JSON.parse(localStorage.getItem("cineRouletteMovies") || "null") || defaultMovies;
    let activeTab = "todo";
    let selectedMovieId = null;
    let rotation = 0;
    let spinning = false;

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

    const palette = ["#ff5b7f","#8d6bff","#38bdf8","#f59e0b","#34d399","#fb7185","#a78bfa","#22d3ee"];

    function save(){
      localStorage.setItem("cineRouletteMovies", JSON.stringify(movies));
      updateUI();
    }

    function updateUI(){
      todoCount.textContent = movies.filter(m => !m.watched).length;
      watchedCount.textContent = movies.filter(m => m.watched).length;
      spinBtn.disabled = movies.filter(m => !m.watched).length === 0 || spinning;
      renderList();
      drawWheel();
    }

    function renderList(){
      const query = searchInput.value.trim().toLowerCase();
      const filtered = movies
        .filter(m => activeTab === "todo" ? !m.watched : m.watched)
        .filter(m => m.title.toLowerCase().includes(query));

      if(!filtered.length){
        movieList.innerHTML = `<div class="empty">${query ? "Aucun film trouvé." : activeTab === "todo" ? "La liste est vide. Ajoutez un film !" : "Aucun film regardé pour le moment."}</div>`;
        return;
      }

      movieList.innerHTML = filtered.map((movie,index) => `
        <div class="movie">
          <div class="movie-number">${index+1}</div>
          <div class="movie-title" title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</div>
          <div class="movie-actions">
            <button class="icon-btn" title="${movie.watched ? "Remettre à regarder" : "Marquer comme regardé"}" onclick="toggleWatched(${movie.id})">${movie.watched ? "↩" : "✓"}</button>
            <button class="icon-btn" title="Supprimer" onclick="removeMovie(${movie.id})">×</button>
          </div>
        </div>
      `).join("");
    }

    function drawWheel(){
      const items = movies.filter(m => !m.watched);
      const w = canvas.width, h = canvas.height, cx = w/2, cy = h/2, radius = w*.45;
      ctx.clearRect(0,0,w,h);

      if(!items.length){
        ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fillStyle="#2a2535";ctx.fill();
        ctx.fillStyle="#aaa3b9";ctx.font="700 40px Inter, sans-serif";ctx.textAlign="center";
        ctx.fillText("Ajoutez un film",cx,cy);
        return;
      }

      const arc = Math.PI*2/items.length;
      ctx.save();
      ctx.translate(cx,cy);
      ctx.rotate(rotation);

      items.forEach((movie,i)=>{
        const start = i*arc - Math.PI/2;
        const end = start + arc;
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.arc(0,0,radius,start,end);
        ctx.closePath();
        ctx.fillStyle = palette[i % palette.length];
        ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,.18)";
        ctx.lineWidth=3;
        ctx.stroke();

        ctx.save();
        ctx.rotate(start + arc/2);
        ctx.textAlign="right";
        ctx.fillStyle="#fff";
        const maxText = items.length > 20 ? 18 : items.length > 12 ? 24 : 31;
        ctx.font=`800 ${maxText}px Inter, sans-serif`;
        const maxChars = items.length > 20 ? 15 : items.length > 12 ? 19 : 25;
        const label = movie.title.length > maxChars ? movie.title.slice(0,maxChars-1)+"…" : movie.title;
        ctx.fillText(label,radius-32,9);
        ctx.restore();
      });

      ctx.restore();
      ctx.beginPath();ctx.arc(cx,cy,radius*.16,0,Math.PI*2);
      ctx.fillStyle="#181520";ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,.25)";ctx.lineWidth=6;ctx.stroke();
      ctx.fillStyle="#fff";ctx.font="900 34px Inter, sans-serif";ctx.textAlign="center";
      ctx.fillText("GO",cx,cy+12);
    }

    function spin(){
      const items = movies.filter(m => !m.watched);
      if(!items.length || spinning) return;
      spinning = true;
      spinBtn.disabled = true;

      const winnerIndex = Math.floor(Math.random()*items.length);
      const arc = Math.PI*2/items.length;
      const target = -(winnerIndex*arc + arc/2);
      const extraTurns = (6 + Math.floor(Math.random()*3))*Math.PI*2;
      const startRotation = rotation;
      const targetRotation = target + extraTurns;
      const duration = 4200;
      const startTime = performance.now();

      function animate(now){
        const t = Math.min((now-startTime)/duration,1);
        const eased = 1 - Math.pow(1-t,4);
        rotation = startRotation + (targetRotation-startRotation)*eased;
        drawWheel();
        if(t<1){
          requestAnimationFrame(animate);
        } else {
          rotation = ((rotation % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
          spinning = false;
          selectedMovieId = items[winnerIndex].id;
          resultMovie.textContent = items[winnerIndex].title;
          modal.classList.add("show");
          updateUI();
        }
      }
      requestAnimationFrame(animate);
    }

    function toggleWatched(id){
      movies = movies.map(m => m.id === id ? {...m, watched:!m.watched} : m);
      save();
      showToast("Liste mise à jour");
    }

    function removeMovie(id){
      const movie = movies.find(m => m.id === id);
      if(!movie) return;
      if(confirm(`Supprimer « ${movie.title} » ?`)){
        movies = movies.filter(m => m.id !== id);
        save();
        showToast("Film supprimé");
      }
    }

    function showToast(message){
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(()=>toast.classList.remove("show"),1800);
    }

    function escapeHtml(str){
      return str.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
    }

    document.getElementById("addForm").addEventListener("submit", e=>{
      e.preventDefault();
      const input = document.getElementById("movieInput");
      const title = input.value.trim();
      if(!title) return;
      if(movies.some(m => m.title.toLowerCase() === title.toLowerCase())){
        showToast("Ce film est déjà dans la liste");
        return;
      }
      movies.unshift({id:Date.now(), title, watched:false});
      input.value="";
      activeTab="todo";
      document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab==="todo"));
      save();
      showToast("Film ajouté à la roue");
    });

    document.querySelectorAll(".tab").forEach(tab=>{
      tab.addEventListener("click",()=>{
        activeTab=tab.dataset.tab;
        document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===tab));
        renderList();
      });
    });

    searchInput.addEventListener("input",renderList);
    spinBtn.addEventListener("click",spin);
    document.getElementById("closeModal").addEventListener("click",()=>modal.classList.remove("show"));
    document.getElementById("markWatched").addEventListener("click",()=>{
      if(selectedMovieId !== null){
        movies = movies.map(m => m.id === selectedMovieId ? {...m,watched:true} : m);
        save();
        modal.classList.remove("show");
        showToast("Film déplacé dans les films regardés");
      }
    });
    modal.addEventListener("click",e=>{if(e.target===modal) modal.classList.remove("show")});

    updateUI();
