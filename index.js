/* global AFRAME */

if (typeof AFRAME === 'undefined') {
    throw new Error('Component attempted to register before AFRAME was available.');
  }
  
  /**
   * Lounge collider, to detect collisions in the lounge.
   * Adapted and simplified from
   * https://github.com/supermedium/superframe/blob/master/components/aabb-collider/index.js
   */
  AFRAME.registerComponent('lounge-collider', {
    schema: {
      interval: {type: 'number', default: 80},
      objects: {type: 'selectorAll', default: ''}
    },
  
    init: function () {
      this.boundingBox = new THREE.Box3();
      this.boxCenter = new THREE.Vector3();
      this.objectEls = [];
      this.intersectedEls = [];
      this.previousIntersectedEls = [];
      this.newIntersectedEls = [];
      this.clearedIntersectedEls = [];
      this.prevCheckTime = undefined;
      this.observer = new MutationObserver(this.setDirty);
      this.setDirty = this.setDirty.bind(this);
      this.boxMax = new THREE.Vector3();
      this.boxMin = new THREE.Vector3();
    },
  
    play: function () {
      this.observer.observe(this.el.sceneEl,
                            {childList: true, attributes: true, subtree: true});
      this.el.sceneEl.addEventListener('object3dset', this.setDirty);
      this.el.sceneEl.addEventListener('object3dremove', this.setDirty);
    },
  
    remove: function () {
      this.observer.disconnect();
      this.el.sceneEl.removeEventListener('object3dset', this.setDirty);
      this.el.sceneEl.removeEventListener('object3dremove', this.setDirty);
    },
  
    tick: function (time) {
      const boundingBox = this.boundingBox;
      const el = this.el;
      const objectEls = this.objectEls;
      const intersectedEls = this.intersectedEls;
      const previousIntersectedEls = this.previousIntersectedEls;
      const newIntersectedEls = this.newIntersectedEls;
      const clearedIntersectedEls = this.clearedIntersectedEls;
      const prevCheckTime = this.prevCheckTime;
  
      // Only check for intersection if interval time has passed.
      if (prevCheckTime && (time - prevCheckTime < this.data.interval)) { return; }
      // Update check time.
      this.prevCheckTime = time;
  
      if (this.dirty) { this.refreshObjects(); };
  
      // Update the bounding box to account for rotations and position changes.
      boundingBox.setFromObject(el.object3D);
      this.boxMin.copy(boundingBox.min);
      this.boxMax.copy(boundingBox.max);
      boundingBox.getCenter(this.boxCenter);
  
      // Copy intersectedEls in previousIntersectedEls
      previousIntersectedEls.length = 0;
      for (let i = 0; i < intersectedEls.length; i++) {
        previousIntersectedEls[i] = intersectedEls[i];
      };
  
      // Populate intersectedEls array.
      intersectedEls.length = 0;
      for (i = 0; i < objectEls.length; i++) {
        if (objectEls[i] === this.el) { continue; }
        // Check for intersection.
        if (this.isIntersecting(objectEls[i])) { intersectedEls.push(objectEls[i]); }
      };
  
      // Get newly intersected entities.
      newIntersectedEls.length = 0;
      for (i = 0; i < intersectedEls.length; i++) {
        if (previousIntersectedEls.indexOf(intersectedEls[i]) === -1) {
          newIntersectedEls.push(intersectedEls[i]);
        }
      };
  
      // Emit cleared events on no longer intersected entities.
      clearedIntersectedEls.length = 0;
      for (i = 0; i < previousIntersectedEls.length; i++) {
        if (intersectedEls.indexOf(previousIntersectedEls[i]) !== -1) { continue; }
        previousIntersectedEls[i].emit('hitend');
        clearedIntersectedEls.push(previousIntersectedEls[i]);
      };
  
      // Emit events on intersected entities. Do this after the cleared events.
      for (i = 0; i < newIntersectedEls.length; i++) {
        if (newIntersectedEls[i] === this.el) { continue; }
        newIntersectedEls[i].emit('hitstart');
      };
    },
  
    /**
     * AABB collision detection.
     * 3D version of https://www.youtube.com/watch?v=ghqD3e37R7E
     */
    isIntersecting: (function (el) {
      let box;
  
      if (!el.object3D) { return false };
      if (!el.object3D.aabbBox) {
        // Box.
        el.object3D.aabbBox = new THREE.Box3().setFromObject(el.object3D);
        // Center.
        el.object3D.boundingBoxCenter = new THREE.Vector3();
        el.object3D.aabbBox.getCenter(el.object3D.boundingBoxCenter);
      };
      box = el.object3D.aabbBox;
  
      const boxMin = box.min;
      const boxMax = box.max;
      return (this.boxMin.x <= boxMax.x && this.boxMax.x >= boxMin.x) &&
             (this.boxMin.y <= boxMax.y && this.boxMax.y >= boxMin.y) &&
             (this.boxMin.z <= boxMax.z && this.boxMax.z >= boxMin.z);
    }),
  
    /**
     * Mark the object list as dirty, to be refreshed before next raycast.
     */
    setDirty: function () {
      this.dirty = true;
    },
  
    /**
     * Update list of objects to test for intersection.
     */
    refreshObjects: function () {
      const data = this.data;
      // If objects not defined, intersect with everything.
      if (data.objects) {
        this.objectEls = this.el.sceneEl.querySelectorAll(data.objects);
      } else {
        this.objectEls = this.el.sceneEl.children;
      }
      this.dirty = false;
    }
  });
  
  /**
   * Lounge plinth, to set up stuff in the lounge. Zócalo de salón, para colocar cosas en el salón.
   */
  AFRAME.registerComponent('lounge-plinth', {
    schema: {
      width: {type: 'number', default: 1},
      depth: {type: 'number', default: 1},
      height: {type: 'number', default: .5},
      color: {type: 'color', default: '#404040'},
    },
  
    /**
     * Set if component needs multiple instancing.
     */
    multiple: false,
  
    /**
     * Called once when component is attached. Generally for initial setup.
     */
    init: function () {
      let el = this.el;
      let data = this.data;
  
      console.log("lounge-plinth (init)");
      this.el.setAttribute('geometry', {
        'primitive': 'box',
        'width': this.data.width,
        'depth': this.data.depth,
        'height': this.data.height
      });
      this.el.setAttribute('material', {'color': this.data.color});
      this.el.addEventListener("staydown", function (event) {
        // When "staydown" received, set position to to be on floor
        let localPosition = el.object3D.worldToLocal(event.detail.worldPosition);
        el.object3D.position.y = localPosition.y + data.height/2;
      });
    },
  
    update: function (oldData) {
    },
  
    remove: function () { }
  });
  
  /**
   * Lounge staydown component, making the entity, if in a lounge,
     to "fall down" to the floor. 
Componente de permanencia en la sala VIP, lo que hace que la entidad, si se encuentra en una sala VIP,
     "caerse" al suelo.
   */
  AFRAME.registerComponent('lounge-staydown', {
    schema: {
    },
  
    /**
     * Set if component needs multiple instancing.
     */
    multiple: false,
  
    /**
     * Emit an event with floor position
     */
    floor_level: function(position) {
      localPosition = new THREE.Vector3(position.x,
                                        position.y,
                                        position.z);
      this.el.object3D.updateMatrixWorld();
      this.el.emit('staydown',
                   {worldPosition: this.el.object3D.localToWorld(localPosition)},
                   false);
    },
  
    /**
     * Called once when component is attached. Generally for initial setup.
     */
    init: function () {
      console.log("lounge-staydown component (init)");
      let floor_level = this.floor_level.bind(this);
      let el = this.el;
  
      // Find entity with lounge component
      let ancestor = el;
      while ((ancestor = ancestor.parentNode) && !("lounge" in ancestor.attributes));
      let loungeEntity = ancestor;
      loungeEntity.addEventListener("loaded", function () {
        // When the entity with lounge is loaded, find floor level
        let floorEntity = loungeEntity.querySelector("a-entity[lounge-floor]")
        let floorComponent = floorEntity.components["lounge-floor"];
        if ('data' in floorComponent) {
          // floorComponent already initialized
          floor_level(floorComponent.data.position);
        } else {
          // floorComponent not initialized yet, set a listener
          floorEntity.addEventListener("componentinitialized", function(event) {
            if (event.detail.name == "lounge-floor") {
              floor_level(floorComponent.data.position);
            };
          });
        };
      });
    },
  
    update: function (oldData) {
    },
  
    remove: function () { }
  });
  
  
  /**
   * Lounge entry point component, usually for the camera rig
   * Sets position of entity to that of the entry point in a lounge,
   * usually on the floor.
   * If loungeId is not found, find the first lounge in the scene.
   */
  AFRAME.registerComponent('lounge-entry-point', {
    schema: {
      loungeId: {type: 'string', default: 'lounge'},
    },
  
    /**
     * Set if component needs multiple instancing.
     */
    multiple: false,
  
    /**
     * Called once when component is attached. Generally for initial setup.
     */
    init: function () {
      let el = this.el;
      console.log("lounge-entry-point component (init)");
      let lounge = document.getElementById(this.data.loungeId);
      if (lounge == null) {
        lounge = document.querySelector("a-entity[lounge]");
      };
      lounge.addEventListener("componentinitialized", function(event) {
        if (event.detail.name == "lounge") {
          let point = lounge.components.lounge.entry_point();
          let pointLocal = el.object3D.worldToLocal(point);
          el.object3D.position.copy(pointLocal);
        };
      });
    },
  
    update: function (oldData) {
    },
  
    remove: function () { }
  });
  
  /**
   * Floor component for the Lounge
   */
  AFRAME.registerComponent('lounge-floor', {
    schema: {
      width: {type: 'number', default: 10},
      depth: {type: 'number', default: 7},
      color: {type: 'color', default: ''},
      texture: {type: 'asset', default: ''},
      position: {type: 'vec3', default: {x: 0, y: 0, z: 0}}
    },
  
    /**
     * Set if component needs multiple instancing.
     */
    multiple: false,
  
    /**
     * Called once when component is attached. Generally for initial setup.
     */
    init: function () {
      console.log("lounge-floor component (init)");
      this.floor = document.createElement('a-plane');
      this.floor.setAttribute('class', 'lounge-floor');
      if (this.data.color == '' && this.data.texture == '') {
        this.data.color = '#808080';
      };
      this.floor.setAttribute('color', this.data.color);
      this.floor.setAttribute('src', this.data.texture);
      this.floor.setAttribute('width', this.data.width);
      this.floor.setAttribute('height', this.data.depth);
      this.floor.setAttribute('position', this.data.position);
      this.floor.setAttribute('rotation', '270 0 0');
      this.floor.setAttribute('side', 'double');
  //    this.floor.setAttribute('static-body', '');
      this.el.appendChild(this.floor);
    },
    update: function (oldData) {
    },
  
    remove: function () { }
  });
  
  /**
   * Ceiling component for the Lounge
   */
  AFRAME.registerComponent('lounge-ceiling', {
    schema: {
      width: {type: 'number', default: 10},
      depth: {type: 'number', default: 7},
      color: {type: 'color', default: '#808080'},
      position: {type: 'vec3', default: {x: 0, y: 0, z: 0}}
    },
  
    /**
     * Set if component needs multiple instancing.
     */
    multiple: false,
  
    /**
     * Called once when component is attached. Generally for initial setup.
     */
    init: function () {
      console.log("lounge-ceiling component (init)");
      this.floor = document.createElement('a-plane');
      this.floor.setAttribute('class', 'lounge-ceiling');
      this.floor.setAttribute('color', this.data.color);
      this.floor.setAttribute('width', this.data.width);
      this.floor.setAttribute('height', this.data.depth);
      this.floor.setAttribute('position', this.data.position);
      this.floor.setAttribute('rotation', '90 0 0');
      this.floor.setAttribute('side', 'double');
  //    this.floor.setAttribute('static-body', '');
      this.el.appendChild(this.floor);
    },
    update: function (oldData) {
    },
  
    remove: function () { }
  });
  
  /**
   * Wall component for the Lounge
   */
  AFRAME.registerComponent('lounge-wall', {
    schema: {
      width: {type: 'number', default: 10},
      height: {type: 'number', default: 4},
      depth: {type: 'number', default: .3},
      color: {type: 'color', default: '#aaa4a4'},
      position: {type: 'vec3', default: {x: 0, y: 0, z: 0}},
      opacity: {type: 'number', default: 1},
      wireframe: {type: 'boolean', default: false}
    },
  
    /**
     * Set if component needs multiple instancing.
     */
    multiple: true,
  
    /**
     * Called once when component is attached. Generally for initial setup.
     */
    init: function () {
      data = this.data;
      console.log("lounge-wall component (init)");
      this.wall = document.createElement('a-box');
      this.wall.setAttribute('class', 'lounge-wall');
      if (this.id == 'north') {
        this.wall.setAttribute('rotation', '0 0 0');
      } else if (this.id == 'east') {
        this.wall.setAttribute('rotation', '0 90 0');
      } else if (this.id == 'south') {
        this.wall.setAttribute('rotation', '0 180 0');
      } else if (this.id == 'west') {
        this.wall.setAttribute('rotation', '0 270 0');
      }
      this.el.appendChild(this.wall);
    },
  
    update: function (oldData) {
      data = this.data;
      console.log("lounge-wall component (update)");
      this.wall.setAttribute('color', data.color);
      this.wall.setAttribute('width', data.width);
      this.wall.setAttribute('depth', data.depth);
      this.wall.setAttribute('height', data.height);
      this.wall.setAttribute('position', data.position);
      if (data.opacity < 1) {
        this.wall.setAttribute('material', {transparent: true, opacity: data.opacity});
      };
      this.wall.setAttribute('wireframe', data.wireframe);
    },
  
    remove: function () { }
  });
  
  /**
   * Lounge component for A-Frame.
   */
  AFRAME.registerComponent('lounge', {
    schema: {
      width: {type: 'number', default: 10},
      height: {type: 'number', default: 4},
      depth: {type: 'number', default: 7},
      floorColor: {type: 'color', default: ''},
      floorTexture: {type: 'asset', default: ''},
      // Walls values: 'wall', 'open', 'barrier', 'glass'... wall - pared, open - abierto, barrier - abierto con varandilla, glass - cristal
      north: {type: 'string', default: 'wall'},
      east: {type: 'string', default: 'wall'},
      south: {type: 'string', default: 'wall'},
      west: {type: 'string', default: 'wall'},
      wallColor: {type: 'color', default: '#aaa4a4'},
      

      // Affects 'barrier' and 'glass'
      glassOpacity: {type: 'number', default: 0.4},
      // Affects 'barrier'
      barrierHeight: {type: 'number', default: 1.4},
      ceiling: {type: 'boolean', default: true},
      entryPoint: {type: 'vec3', default: {}},
    },
  
    /**
     * Set if component needs multiple instancing.
     */
    multiple: false,
  
    /**
     * Called once when component is attached. Generally for initial setup.
     */
    init: function () {
      let data = this.data;
      console.log("lounge component (init)");
      this.lounge = document.createElement('a-entity');
      this.lounge.setAttribute('lounge-floor', {
        'color': data.floorColor,
        'texture': data.floorTexture,
        'width': data.width,
        'depth': data.depth,
        'position': {x: 0, y: -data.height/2, z: 0}
      });
      let walls = {};
      const directions = {
        'north': {x: 0, z: -data.depth/2, width: data.width},
        'east': {x: data.width/2, z: 0, width: data.depth},
        'south': {x: 0, z: data.depth/2, width: data.width},
        'west': {x: -data.width/2, z: 0, width: data.depth}
      };
      for (direction in directions) {
        wall = {}
        if (['wall', 'barrier', 'glass'].includes(data[direction])) {
          wall.x = directions[direction].x;
          wall.z = directions[direction].z;
          wall.width = directions[direction].width;
          if (['wall', 'glass'].includes(data[direction])) {
            // Full walls
            wall.height = data.height;
            wall.y = 0;
          } else if (data[direction] == 'barrier') {
            // Partial wall
            wall.height = data.barrierHeight;
            wall.y = (wall.height - data.height) / 2;
          };
          if (['glass', 'barrier'].includes(data[direction])) {
            wall.opacity = data.glassOpacity;
          } else {
            wall.opacity = 1;
          };
          walls[direction] = wall;
        };
      };
      for (const facing in walls) {
        const wall = walls[facing];
        this.lounge.setAttribute('lounge-wall__' + facing, {
          'color': this.data.wallColor,
          'width': wall.width,
          'height': wall.height,
          'position': {x: wall.x, y: wall.y, z: wall.z},
          'opacity': wall.opacity
        });
      };
      if (this.data.ceiling) {
        this.lounge.setAttribute('lounge-ceiling', {
          'color': this.data.ceilingColor,
          'width': this.data.width,
          'depth': this.data.depth,
          'position': {x: 0, y: this.data.height/2, z: 0}
        });
      };
      this.el.appendChild(this.lounge);
      console.log(this.lounge);
    },
  
    /**
     * Called when component is attached and when component data changes.
     * Generally modifies the entity based on the data.
     */
    update: function (oldData) {
    },
  
    /**
     * Called when a component is removed (e.g., via removeAttribute).
     * Generally undoes all modifications to the entity.
     */
    remove: function () { },
  
    /**
     * Called on each scene tick.
     */
    // tick: function (t) { },
  
    /**
     * Called when entity pauses.
     * Use to stop or remove any dynamic or background behavior such as events.
     */
    pause: function () { },
  
    /**
     * Called when entity resumes.
     * Use to continue or add any dynamic or background behavior such as events.
     */
    play: function () { },
  
    /**
     * Event handlers that automatically get attached or detached based on scene state.
     */
    events: {
      // click: function (evt) { }
    },
  
    /**
     * Give a position located in the floor (in world coordinates)
     * that can act as an entry point for the room.
     */
    entry_point() {
      var point;
      if (Object.keys(this.data.entryPoint).length == 0) {
        point = new THREE.Vector3(0, -this.data.height/2, this.data.depth/4);
      } else {
        point = new THREE.Vector3(this.data.entryPoint.x,
                                  this.data.entryPoint.y,
                                  this.data.entryPoint.z);
      };
      this.el.object3D.updateMatrixWorld()
      return this.el.object3D.localToWorld(point);
    },
  });

  function calculateDistance(pos1, pos2) {
    return pos1.distanceTo(pos2);
  }


  AFRAME.registerComponent('distance', {
    
    schema: {
      camera: { type: 'selector', default: '' },
      distanceLimit: { type: 'number', default: 10 }
    },

    init: function () {
    console.log('El componente distance se está ejecutando');
      console.log('ESTOY EN INIT');
      //me hago una copia del valor porque si no se actualiza automaticamente porque ambas variables apuntan al mismo objeto en la memoria
      this.prevCamPos = new THREE.Vector3().copy(this.data.camera.object3D.position);
      console.log('LLEGO AQUI 1')
      this.frameCount = 0;
      this.framesToSkip = 60;  // Ejecutar cada 60 fotogramas (1 segundo a 60 FPS)
      this.tick();
    },
    // Pasa la función calculateDistance al componente como un método
    calculateDistance: calculateDistance,

    tick: function() {

      // Incrementa el contador de fotogramas
      this.frameCount++;

      if (this.frameCount >= this.framesToSkip) {
        console.log('La función tick se ejecutó');
        var elemPos = this.el.getAttribute('position');
        console.log('Posición del objeto elemPos:', elemPos.x, elemPos.y, elemPos.z);

        var camPosNow = this.data.camera.object3D.position;

        var distanceLimit = this.data.distanceLimit;
        console.log('distanceLimit '+distanceLimit)
        console.log('Posición del objeto camPosNow:', camPosNow.x, camPosNow.y, camPosNow.z);
        // console.log('Posición del objeto prevCamPos FINAL:', this.prevCamPos.x, this.prevCamPos.y, this.prevCamPos.z);
        if (camPosNow.x !== this.prevCamPos.x || camPosNow.y !== this.prevCamPos.y || camPosNow.z !== this.prevCamPos.z) {
          console.log('ME HE MOVIDO')
          var distance = this.calculateDistance(camPosNow,elemPos);
          console.log('distance ' + distance)
              if (distance < distanceLimit) {
                console.log('DISPARO PLAY')
                this.el.sceneEl.emit('cercaObjeto', {elem: this.el, id: this.el.id, distance: distance});
              }

              if (distance >= distanceLimit) {
                console.log("ME ALEJÉ DEL ELEMENTO");
                this.el.sceneEl.emit('lejosObjeto', {elem: this.el, id: this.el.id});
              }
          // Actualiza la posición anterior
          this.prevCamPos.copy(camPosNow)
        }



        // Reinicia el contador de fotogramas
        this.frameCount = 0;
      }

      // Vuelve a programar la ejecución de la función tick para el próximo fotograma
      // this.el.sceneEl.renderer.xr.getSession().requestAnimationFrame(this.tick.bind(this));
      this.el.sceneEl.renderer.xr.getSession()?.requestAnimationFrame(this.tick.bind(this));
    // const session = this.el.sceneEl.renderer.xr.getSession();
    // if (session) {
    //   session.requestAnimationFrame(this.tick.bind(this));
    // }


    }

  });

  document.addEventListener('cercaObjeto', function(event) {
    // Accede al elemento y sus atributos desde el evento
    var elemento = event.detail.elem;
    console.log('elemento ' + elemento)
    console.log('sound component:', elemento.components.sound);
    var idElemento = event.detail.id;
    var distance = event.detail.distance;

    // Imprime todos los atributos del elemento
    var atributosElemento = elemento.attributes;
    console.log('Atributos del elemento con ID', idElemento);
    for (var i = 0; i < atributosElemento.length; i++) {
      var nombreAtributo = atributosElemento[i].name;
      var valorAtributo = atributosElemento[i].value;
      console.log('Atributo:', nombreAtributo, 'Valor:', valorAtributo);
      if(nombreAtributo === 'sound'){
        var audio = document.querySelector(elemento.components.sound.attrValue.src);
        console.log('RAC AUDIO 55: ' + audio);
        var isPlay = false;

          console.log('CLICCCCCCCCCC')
          console.log('isPlay ' + isPlay)
          
          if (isPlay) {
            audio.pause();
            console.log('Audio pausado');
            isPlay = false;

          } else {
            audio.play();
            console.log('Audio activado');
            isPlay = true;

          }

      }else if(nombreAtributo === 'opacidad_interruptor'){
        console.log('ACTIVO OPACIDAD')
        if(distance >= 12){
            elemento.setAttribute('material', 'opacity: 0.8'); 
          }else if(distance <= 12 && distance > 7 ){
            elemento.setAttribute('material', 'opacity: 0.6'); 
          }else if(distance <= 7 && distance > 5){
            elemento.setAttribute('material', 'opacity: 0.3'); 
          }else{
            elemento.setAttribute('material', 'opacity: 0');
          }
      }else if(nombreAtributo === 'luz_interruptor'){
        console.log('ACTIVO LUZ');
        let el = document.getElementById('luzCalavera');
        el.setAttribute('light', 'intensity: 3');
      }else if(nombreAtributo === 'interruptor_video'){
        console.log('ACTIVO VIDEO');
        var elemVideo = document.getElementById('videoElefante');
        elemVideo.setAttribute('visible', 'true');
        let video = elemVideo.components.material.material.map.image;
        video.play();
      }
    }
  });

  document.addEventListener('lejosObjeto', function(event) {
    // Accede al elemento y sus atributos desde el evento
    var elemento = event.detail.elem;
    var idElemento = event.detail.id;

    // Imprime todos los atributos del elemento
    var atributosElemento = elemento.attributes;
    console.log('Atributos del elemento con ID', idElemento);
    for (var i = 0; i < atributosElemento.length; i++) {
      var nombreAtributo = atributosElemento[i].name;
      var valorAtributo = atributosElemento[i].value;
      console.log('Atributo:', nombreAtributo, 'Valor:', valorAtributo);
      if(nombreAtributo === 'sound'){
        var audio = document.querySelector(elemento.components.sound.attrValue.src);
        audio.pause();
        console.log('HE DESACTIVADO AUDIO');
        
      }else if(nombreAtributo === 'opacidad_interruptor'){
        elemento.setAttribute('material', 'opacity: 1');
      }else if(nombreAtributo === 'luz_interruptor'){
        let el = document.getElementById('luzCalavera');
        el.setAttribute('light', 'intensity: 0');
      }else if(nombreAtributo === 'interruptor_video'){
        var elemVideo = document.getElementById('videoElefante');
        console.log('PARO VIDEO');
        let video = elemVideo.components.material.material.map.image;
        video.pause();
        elemVideo.setAttribute('visible', 'false');

        
      }
    }
  });

  document.addEventListener('desactivarTextoSonido', function(event) {
    const boton = document.getElementById('textoActivarSonido');
    boton.setAttribute('visible', 'false');


  });

  AFRAME.registerComponent('clickable', {
    init: function () {
      var el = this.el;
      document.addEventListener('activarTextoSonido', function(event) {

        const botonActivar = document.getElementById('textoActivarSonido');
        botonActivar.setAttribute('visible', 'true');
        const textoActivar = document.getElementById('textoActivar');



        // Accede al componente de sonido
        var audio = document.querySelector(el.components.sound.attrValue.src);
        console.log('RAC AUDIO 55: ' + audio);
        var isPlay = false;
        el.addEventListener('click', function(event) {
          console.log('CLICCCCCCCCCC')
          console.log('isPlay ' + isPlay)
          
          if (isPlay) {
            audio.pause();
            console.log('Audio pausado');
            isPlay = false;
            botonActivar.setAttribute('color', 'green');
            textoActivar.setAttribute('value', 'Activar sonido');
          } else {
            audio.play();
            console.log('Audio activado');
            isPlay = true;
            botonActivar.setAttribute('color', 'red');
            textoActivar.setAttribute('value', 'Parar sonido');
          }
        });
    });

    }
});

AFRAME.registerComponent('tiempo', {
    init: function () {
      console.log('this.el.id ' + this.el.id)
      // Función para mostrar el texto cada 5 segundos durante 1 segundo
      setInterval(() => {
        // Muestra el texto
        this.el.setAttribute('visible', 'true');

        // Oculta el texto después de 1 segundo
        setTimeout(() => {
          this.el.setAttribute('visible', 'false');
        }, 1000);
      }, 5000);
    },

  });

 
  
