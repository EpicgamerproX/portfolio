class GridMesh {
  constructor() {
    this.canvas = document.getElementById("grid-mesh-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.nodes = [];
    this.mouse = {
      x: -10000,
      y: -10000,
      targetX: -10000,
      targetY: -10000,
      active: false,
      radius: 210,
    };
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.8);
    this.time = 0;
    this.isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.isMobile = window.matchMedia("(max-width: 768px)").matches;
    this.cursorGlow = document.querySelector(".cursor-glow");

    this.handleResize = this.handleResize.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.animate = this.animate.bind(this);

    this.setup();
  }

  setup() {
    this.resize();
    this.bindEvents();
    this.animate();
  }

  bindEvents() {
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", this.handlePointerLeave);
  }

  handleResize() {
    this.isMobile = window.matchMedia("(max-width: 768px)").matches;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.8);
    this.resize();
  }

  handlePointerMove(event) {
    this.mouse.targetX = event.clientX;
    this.mouse.targetY = event.clientY;
    this.mouse.active = true;

    if (this.cursorGlow) {
      this.cursorGlow.style.opacity = "1";
      this.cursorGlow.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    }
  }

  handlePointerLeave() {
    this.mouse.active = false;
    this.mouse.targetX = -10000;
    this.mouse.targetY = -10000;

    if (this.cursorGlow) {
      this.cursorGlow.style.opacity = "0";
    }
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.width = width;
    this.height = height;
    this.canvas.width = Math.floor(width * this.pixelRatio);
    this.canvas.height = Math.floor(height * this.pixelRatio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    this.createGrid();
  }

  createGrid() {
    this.nodes = [];

    const spacing = this.isMobile ? 78 : Math.max(58, Math.min(92, this.width / 21));
    const cols = Math.ceil((this.width + spacing * 3) / spacing);
    const rows = Math.ceil((this.height + spacing * 3) / spacing);
    const centerX = this.width / 2;

    for (let row = 0; row < rows; row += 1) {
      const rowNodes = [];
      const rowProgress = rows > 1 ? row / (rows - 1) : 0;
      const perspective = 0.76 + rowProgress * 0.46;
      const lift = (1 - rowProgress) * spacing * 0.28;

      for (let col = 0; col < cols; col += 1) {
        const baseX = (col * spacing - spacing * 1.5 - centerX) * perspective + centerX;
        const baseY = row * spacing - spacing * 1.5 + lift;
        const depth = 0.72 + rowProgress * 0.52;
        const phase = row * 0.35 + col * 0.2;

        rowNodes.push({
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          velocityX: 0,
          velocityY: 0,
          depth,
          phase,
          rowProgress,
          glow: 0,
        });
      }

      this.nodes.push(rowNodes);
    }
  }

  animate() {
    window.requestAnimationFrame(this.animate);
    this.time += this.isReducedMotion ? 0.0025 : 0.008;

    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.12;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.12;

    this.updateNodes();
    this.draw();
  }

  updateNodes() {
    const spring = this.isReducedMotion ? 0.04 : 0.07;
    const damping = this.isReducedMotion ? 0.84 : 0.88;

    for (let row = 0; row < this.nodes.length; row += 1) {
      for (let col = 0; col < this.nodes[row].length; col += 1) {
        const node = this.nodes[row][col];
        const idleX = Math.sin(this.time + node.phase) * 1.2 * node.depth;
        const idleY = Math.cos(this.time * 0.8 + node.phase) * 1.8 * node.depth;

        let forceX = 0;
        let forceY = 0;
        let glow = 0;

        if (!this.isMobile && this.mouse.active) {
          const deltaX = this.mouse.x - node.baseX;
          const deltaY = this.mouse.y - node.baseY;
          const distance = Math.hypot(deltaX, deltaY);

          if (distance < this.mouse.radius) {
            const influence = 1 - distance / this.mouse.radius;
            const directionX = deltaX / (distance || 1);
            const directionY = deltaY / (distance || 1);
            const stretch = 16 * influence * influence * node.depth;

            forceX = directionX * stretch;
            forceY = directionY * stretch;

            if (distance < this.mouse.radius * 0.32) {
              forceX *= -0.42;
              forceY *= -0.42;
            }

            glow = influence;
          }
        }

        const targetX = node.baseX + idleX + forceX;
        const targetY = node.baseY + idleY + forceY;

        node.velocityX += (targetX - node.x) * spring;
        node.velocityY += (targetY - node.y) * spring;
        node.velocityX *= damping;
        node.velocityY *= damping;

        node.x += node.velocityX;
        node.y += node.velocityY;
        node.glow = glow;
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    for (let row = 0; row < this.nodes.length; row += 1) {
      this.drawRow(this.nodes[row]);
    }

    for (let col = 0; col < this.nodes[0].length; col += 1) {
      this.drawColumn(col);
    }

    this.drawNodes();
  }

  drawRow(rowNodes) {
    if (rowNodes.length < 2) {
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(rowNodes[0].x, rowNodes[0].y);

    for (let index = 0; index < rowNodes.length - 1; index += 1) {
      const current = rowNodes[index];
      const next = rowNodes[index + 1];
      const controlX = (current.x + next.x) / 2;
      const controlY = (current.y + next.y) / 2;
      this.ctx.quadraticCurveTo(current.x, current.y, controlX, controlY);
    }

    const end = rowNodes[rowNodes.length - 1];
    this.ctx.lineTo(end.x, end.y);

    const averageGlow = rowNodes.reduce((sum, node) => sum + node.glow, 0) / rowNodes.length;
    this.ctx.strokeStyle = `rgba(56, 189, 248, ${0.1 + averageGlow * 0.14})`;
    this.ctx.lineWidth = 0.8;
    this.ctx.stroke();
  }

  drawColumn(col) {
    const column = [];

    for (let row = 0; row < this.nodes.length; row += 1) {
      if (this.nodes[row][col]) {
        column.push(this.nodes[row][col]);
      }
    }

    if (column.length < 2) {
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(column[0].x, column[0].y);

    for (let index = 0; index < column.length - 1; index += 1) {
      const current = column[index];
      const next = column[index + 1];
      const controlX = (current.x + next.x) / 2;
      const controlY = (current.y + next.y) / 2;
      this.ctx.quadraticCurveTo(current.x, current.y, controlX, controlY);
    }

    const end = column[column.length - 1];
    this.ctx.lineTo(end.x, end.y);

    const averageGlow = column.reduce((sum, node) => sum + node.glow, 0) / column.length;
    this.ctx.strokeStyle = `rgba(56, 189, 248, ${0.07 + averageGlow * 0.1})`;
    this.ctx.lineWidth = 0.7;
    this.ctx.stroke();
  }

  drawNodes() {
    for (let row = 0; row < this.nodes.length; row += 1) {
      for (let col = 0; col < this.nodes[row].length; col += 1) {
        const node = this.nodes[row][col];
        const size = 1 + node.depth * 0.72 + node.glow * 0.85;
        const alpha = 0.32 + node.rowProgress * 0.22 + node.glow * 0.28;

        if (node.glow > 0) {
          const glowSize = size + 12 + node.glow * 14;
          this.ctx.beginPath();
          this.ctx.fillStyle = `rgba(167, 139, 250, ${node.glow * 0.15})`;
          this.ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
          this.ctx.fill();
        }

        this.ctx.beginPath();
        this.ctx.fillStyle = `rgba(167, 139, 250, ${alpha})`;
        this.ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
}

class IntroSequence {
  constructor() {
    this.intro = document.getElementById("intro-screen");
    this.pageShell = document.getElementById("page-shell");
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  start() {
    const holdTime = this.reduceMotion ? 700 : 1600;

    window.setTimeout(() => {
      this.intro.classList.add("is-hidden");
      this.pageShell.classList.add("is-ready");

      window.setTimeout(() => {
        this.intro.style.display = "none";
      }, 950);
    }, holdTime);
  }
}

class PortfolioUI {
  constructor() {
    this.menuToggle = document.querySelector(".menu-toggle");
    this.navLinks = document.querySelector(".nav-links");
    this.navbar = document.getElementById("navbar");
    this.customCursor = document.querySelector(".custom-cursor");
    this.revealItems = document.querySelectorAll(".reveal");
    this.sections = document.querySelectorAll("section[id]");
    this.navItems = document.querySelectorAll(".nav-links a");
    this.isMobile = window.matchMedia("(max-width: 768px)").matches;

    this.bindMenu();
    this.bindScrollLinks();
    this.bindActiveNav();
    this.bindNavbarState();
    this.bindReveal();
    this.bindCustomCursor();
  }

  bindMenu() {
    if (!this.menuToggle || !this.navLinks) {
      return;
    }

    this.menuToggle.addEventListener("click", () => {
      const isOpen = this.navLinks.classList.toggle("is-open");
      this.menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  bindScrollLinks() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (event) => {
        const targetSelector = anchor.getAttribute("href");
        if (!targetSelector || targetSelector === "#") {
          return;
        }

        const target = document.querySelector(targetSelector);
        if (!target) {
          return;
        }

        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });

        if (this.navLinks) {
          this.navLinks.classList.remove("is-open");
        }

        if (this.menuToggle) {
          this.menuToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  bindActiveNav() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const current = entry.target.getAttribute("id");
            this.navItems.forEach((item) => {
              item.classList.remove("active");
              if (item.getAttribute("href").slice(1) === current) {
                item.classList.add("active");
              }
            });
          }
        });
      },
      { threshold: 0.35 }
    );

    this.sections.forEach((section) => observer.observe(section));
  }

  bindNavbarState() {
    let ticking = false;
    const updateState = () => {
      if (this.navbar) {
        this.navbar.classList.toggle("is-scrolled", window.scrollY > 24);
      }
      ticking = false;
    };

    updateState();
    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(updateState);
        ticking = true;
      }
    }, { passive: true });
  }

  bindReveal() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );

    this.revealItems.forEach((item) => observer.observe(item));
  }

  bindCustomCursor() {
    if (!this.customCursor) {
      return;
    }

    document.addEventListener(
      "pointermove",
      (event) => {
        this.customCursor.style.opacity = "1";
        this.customCursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      },
      { passive: true }
    );

    document.addEventListener("pointerleave", () => {
      this.customCursor.style.opacity = "0";
    });

    document.addEventListener("pointerdown", () => {
      this.customCursor.style.scale = "0.92";
    });

    document.addEventListener("pointerup", () => {
      this.customCursor.style.scale = "1";
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new IntroSequence().start();
  new GridMesh();
  new PortfolioUI();
});
