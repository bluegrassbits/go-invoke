var GOINVOKE = {
  socket: null,
  queueItemID: null,
  generatorResult: null,
  generatorProgress: null,
  generationPercentDone: 0,
  selectedImage: null,

  sections: {
    prompt: {
      open: true,
      elm: document.getElementById('prompt')
    },
    generation: {
      open: true,
      elm: document.getElementById('generation')
    },
    image: {
      open: true,
      elm: document.getElementById('image')
    },
    server: {
      open: true,
      elm: document.getElementById('server')
    },
  },

  schedulers: {
    "ddim": "ddim",
    "ddpm": "ddpm",
    "deis": "deis",
    "lms": "lms",
    "lms_k": "lms_k",
    "pndm": "pndm",
    "heun": "heun",
    "heun_k": "heun_k",
    "euler": "euler",
    "euler_k": "euler_k",
    "euler_a": "euler_a",
    "kdpm_2": "kdpm_2",
    "kdpm_2_a": "kdpm_2_a",
    "dpmpp_2s": "dpmpp_2s",
    "dpmpp_2s_k": "dpmpp_2s_k",
    "dpmpp_2m": "dpmpp_2m",
    "dpmpp_2m_k": "dpmpp_2m_k",
    "dpmpp_2m_sde": "dpmpp_2m_sde",
    "dpmpp_2m_sde_k": "dpmpp_2m_sde_k",
    "dpmpp_sde": "dpmpp_sde",
    "dpmpp_sde_k": "dpmpp_sde_k",
    "unipc": "unipc",
    "lcm": "lcm",
  },

  elms: {
    address: document.getElementById('address'),
    model_list: document.getElementById('model'),
    positive_prompt: document.getElementById('positive_prompt'),
    negative_prompt: document.getElementById('negative_prompt'),
    steps: document.getElementById('steps'),
    cfg_scale: document.getElementById('cfg_scale'),
    height: document.getElementById('height'),
    width: document.getElementById('width'),
    queue_size: document.getElementById('queue_size'),
    seed: document.getElementById('seed'),
    random: document.getElementById('random'),
    percentBar: document.getElementById('percent-bar'),
    generate: document.getElementById('generate'),
    cancel: document.getElementById('cancel'),
    clear: document.getElementById('clear'),
    scheduler: document.getElementById('scheduler'),
    output: document.getElementById('output'),
    error: document.getElementById('error'),
    gallery: document.getElementById('results-gallery'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    connect: document.getElementById('connect'),
    shuffle: document.getElementById('shuffle'),
    basic_auth: document.getElementById('basic_auth'),
    basic_auth_form: document.getElementById('basic-auth-form'),
  },

  config: {
    queue_id: 'default',
    random: 'true',
    queue_size: 1,
    address: null,
    scheduler: 'euler_a',
    model: null,
    steps: 20,
    cfg_scale: 7.5,
    height: 512,
    width: 512,
    seed: 0,
    username: '',
    basic_auth: 'false',
    positive_prompt: "a painting of a cat",
    negative_prompt: "cartoon, painting, illustration, " +
      "(worst quality, low quality, normal quality:2), " +
      "too many limbs, bad anatomy",
  },

  init: function() {
    // populate scheduler dropdown
    for (var key in this.schedulers) {
      var el = document.createElement('option');
      el.value = this.schedulers[key];
      el.innerHTML = this.schedulers[key];

      this.elms.scheduler.appendChild(el);
    }

    // add button event listeners
    this.elms.connect.onclick = () => { this.connect(); };
    this.elms.shuffle.onclick = () => { this.shuffleSeed(); };
    this.elms.generate.onclick = () => { this.enqueueBatch(); };
    this.elms.cancel.onclick = () => { this.cancelBatch(); };
    this.elms.clear.onclick = () => { this.clearQueue(); };

    // load saved values from localStorage
    for (let key in this.config) {
      let el = document.getElementById(key);
      this.config[key] = this.getSaved(key) || this.config[key];
      console.log(key, this.config[key]);

      if(el) {
        switch(el.type) {
          case 'text':
            el.value = this.config[key];
            el.onkeyup = () => {
              this.saveThis({id: key, value: el.value});
            }
            break;

          case 'textarea':
            el.value = this.config[key];
            el.onkeyup = () => {
              this.saveThis({id: key, value: el.value});
            }
            break;

          case 'checkbox':
            el.checked = this.config[key] == 'true';

            if(key == 'random') {
              this.elms.seed.disabled = el.checked;
            }

            if(key == 'basic_auth') {
              this.elms.basic_auth_form.style.display = el.checked ? 'block' : 'none';
            }

            el.onchange = () => {
              this.saveThis({id: key, value: el.checked});

              if(key == 'random') {
                this.elms.seed.disabled = el.checked;
              }

              if(key == 'basic_auth') {
                this.elms.basic_auth_form.style.display = el.checked ? 'block' : 'none';
              }
            };
            break;

          default:
            el.value = this.config[key];
            el.onchange = () => {
              this.saveThis({id: key, value: el.value});
            };
            break;
        }
      }
    }

    if(this.config.address) this.refreshData();

    // open all sections that were open when the page was last closed
    for(let key in this.sections) {
      let section = this.sections[key];
      section.open = this.getSaved(key) == 'true';
      section.elm.open = section.open;

      let summary = section.elm.querySelector('summary');
      summary.onclick = () => { this.toggleDetails(key); };
    }

    // find all .spinner-button elements and add setpUp and stepDown
    // based on data-target and data-action attributes

    let spinnerButtons = document.querySelectorAll('.spinner-button');
    for (let spinnerButton of spinnerButtons) {
      let target = spinnerButton.getAttribute('data-target');
      let action = spinnerButton.getAttribute('data-action');

      spinnerButton.onclick = () => {
        if (action == 'increment') {
          this.stepUp(spinnerButton, target);
        } else if (action == 'decrement') {
          this.stepDown(spinnerButton, target);
        }
      }
    }
  },

  connect: function() {
    var serverAddress = this.elms.address.value;
    var username = this.elms.username.value;
    var password = this.elms.password.value;
    var url = serverAddress + '/api/v1/app/version';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(username + ':' + password));
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          this.refreshData();
          this.elms.password.style.border = '1px solid var(--ok-color)';
          this.config.basic_auth = btoa(username + ':' + password);
          this.saveThis({id: 'basic_auth', value: this.config.basic_auth});
        } else {
          this.displayError('Invalid credentials');
          this.elms.password.style.border = '1px solid var(--error-color)';
        }
      }
    }.bind(this);

    xhr.send();
  },

  displayError: function(message) {
    this.elms.error.innerHTML = message;
    this.elms.error.style.display = 'block';
    setTimeout(() => {
      this.elms.error.style.display = 'none';
    }, 5000);
  },

  refreshData: function() {
    this.fetchModels();
    this.fetchImages();
  },

  toggleDetails: function(e) {
    var section = this.sections[e];
    section.open = !section.open;
    this.saveThis({id: e, value: section.open});
  },

  getSaved: function(id) { return localStorage.getItem(id) || ""; },

  saveThis: function(e) {
    switch(e.type) {
      case 'checkbox':
        this.config[e.id] = e.checked ? 'true' : 'false';
        localStorage.setItem(e.id, e.checked ? 'true' : 'false');
        break;
      default:
        this.config[e.id] = e.value;
        localStorage.setItem(e.id, e.value);
        break;
    }

    if(e.id == 'address') setTimeout(() => { this.refreshData(); }, 1000);

    if(e.id == 'random') {
      this.elms.seed.disabled = e.checked;

      if (!e.checked) {
        this.saveThis({id: 'queue_size', value: 1});
        this.elms.queue_size.value = 1;
      }
    }
  },

  shuffleSeed: function() {
    try {
      let seed = Math.floor(Math.random() * 1000000000);
      this.elms.seed.value = seed;
      this.saveThis({ id: 'seed', value: this.elms.seed.value });
    } catch (error) {
      this.displayError(error);
    }
  },

  stepUp: function(e, id) {
    var el = document.getElementById(id);
    el.stepUp();
    this.saveThis(el);
  },

  stepDown: function(e, id) {
    var el = document.getElementById(id);
    el.stepDown();
    this.saveThis(el);
  },

  getServerAddressFromInput: function() { return this.elms.address.value; },

  getHeaders: function() {
    let headers = {
      'Content-Type': 'application/json'
    };

    if(this.config.basic_auth) {
      headers.Authorization = 'Basic ' + this.config.basic_auth;
    }

    return headers;
  },

  cancelBatch: function() {
    this.elms.cancel.disabled = true;
    this.elms.clear.disabled = true;

    fetch(`${this.getServerAddressFromInput()}/api/v1/queue/${this.config.queue_id}/i/${this.queueItemID}/cancel`, {
      method: 'PUT',
      headers: this.getHeaders(),
    })
    .then(response => {
      if (response.ok) {
        console.log('Generation cancelled');
        this.elms.cancel.disabled = false;
        this.elms.clear.disabled = false;
        this.elms.percentBar.style.width = '0%';
        this.elms.output.src = '';
      }
    });
  },

  clearQueue: function() {
    this.elms.cancel.disabled = true;
    this.elms.clear.disabled = true;

    fetch(`${this.getServerAddressFromInput()}/api/v1/queue/${this.config.queue_id}/clear`, {
      method: 'PUT',
      headers: this.getHeaders(),
    })
    .then(response => {
      if (response.ok) {
        console.log('Queue cleared');
        this.elms.percentBar.style.width = '0%';
        this.elms.output.src = '';
      }
    });
  },

  enqueueBatch: function() {
    let serverAddress = this.getServerAddressFromInput();
    let model = JSON.parse(this.elms.model_list.value);
    let payload = this.initPayload();
    this.elms.generate.disabled = true;

    fetch(`${serverAddress}/api/v1/queue/${this.config.queue_id}/enqueue_batch`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    })
      .then(response => {
        if (response.ok) {
          this.elms.cancel.disabled = false;
          this.elms.clear.disabled = false;
          this.elms.generate.disabled = false;
          return response.json()
        }

        this.displayError(response.statusText);
        this.elms.generate.disabled = false;
      })
      .then(data => {
        console.log(data);
      }).catch(error => {
        this.displayError(error);
        this.elms.generate.disabled = false;
      }
    );
  },

  unselectImages: function() {
    var selected = document.getElementsByClassName('selected');
    for (let i = 0; i < selected.length; i++) {
      selected[i].classList.remove('selected');
    }
  },

  fetchImages: function() {
    let serverAddress = this.getServerAddressFromInput();

    fetch(`${serverAddress}/api/v1/images/`, {
      credentials: this.config.basic_auth ? 'include' : 'omit',
    }).then(response => {
      if (response.ok) {
        return response.json();
      }
    })
    .then(data => {
      this.elms.gallery.innerHTML = '';

      for (let i = 0; i < data.items.length; i++) {
        let imageContainer = document.createElement('div');
        imageContainer.classList.add('gallery-image-container');
        this.elms.gallery.appendChild(imageContainer);

        let image = data.items[i];
        let img = document.createElement('img');
        img.src = serverAddress + '/' + image.thumbnail_url;
        img.classList.add('gallery-image');

        img.onclick = () => {
          this.unselectImages();

          if(this.selectedImage && this.selectedImage.image_name == image.image_name) {
            this.selectedImage = null;
          } else {
            this.elms.output.src = serverAddress + '/' + image.image_url;
            this.elms.output.style.display = 'block';
            let imageContainer = img.parentElement;
            imageContainer.classList.add('selected');
            this.selectedImage = image;
          }

          fetch(`${serverAddress}/api/v1/images/i/${image.image_name}/metadata`, {
            credentials: this.config.basic_auth ? 'include' : 'omit',
          }).then(response => {
            if (response.ok) {
              return response.json();
            }
          }).then(data => {
            var metadataTable = document.getElementById('metadata-table');
            metadataTable.innerHTML = '';

            for (let key in data) {
              var row = document.createElement('tr');
              var cell = document.createElement('td');

              if(this.config.hasOwnProperty(key)) {
                let loadButton = document.createElement('button');
                loadButton.innerHTML = 'Load';
                let elm = this.elms[key];

                loadButton.onclick = () => {
                  elm.value = data[key];
                  this.saveThis({id: key, value: data[key]});
                }

                cell.appendChild(loadButton);
              }

              row.appendChild(cell);

              cell = document.createElement('td');
              cell.innerHTML = key;
              row.appendChild(cell);

              cell = document.createElement('td');
              cell.innerHTML = JSON.stringify(data[key]);

              row.appendChild(cell);
              metadataTable.appendChild(row);
            }
          }).catch(error => {
            this.displayError(error);
          });
        };

        imageContainer.appendChild(img);

        // bottom button container
        let buttonContainer = document.createElement('div');
        buttonContainer.classList.add('image-button-container');
        imageContainer.appendChild(buttonContainer);

        let deleteButton = document.createElement('button');
        deleteButton.classList.add('delete-button');
        deleteButton.innerHTML = 'Delete';
        deleteButton.onclick = () => {
          fetch(`${serverAddress}/api/v1/images/i/${image.image_name}`, {
            method: 'DELETE',
            headers: this.getHeaders()
          })
          .then(response => {
            if (response.ok) {
              this.fetchImages();

              if (this.elms.output.src.indexOf(image.image_url) > -1) {
                this.elms.output.src = '';
                setTimeout(() => {
                  let firstImage = this.elms.gallery.firstChild.firstChild;
                  output.src = firstImage.src.replace('thumbnail', 'full');
                }, 1000);
              }
            }
          });
        };

        // add link to full image in new tab
        let fullImageButton = document.createElement('a');
        fullImageButton.href = serverAddress + '/' + image.image_url;
        fullImageButton.target = '_blank';
        fullImageButton.innerHTML = 'Full Image';
        fullImageButton.classList.add('full-image-button');

        buttonContainer.appendChild(fullImageButton);
        buttonContainer.appendChild(deleteButton);

        // if #output is empty, display the first image in the gallery
        if (i == 0 && this.elms.output.src.indexOf(window.location.href) > -1) {
          this.elms.output.src = serverAddress + '/' + image.image_url;
        }
      }

    }).catch(error => {
      this.displayError(error);
    });
  },

  fetchModels: function() {
    let serverAddress = this.getServerAddressFromInput();
    fetch(`${serverAddress}/api/v1/models/`, {
      credentials: this.config.basic_auth ? 'include' : 'omit',
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      }
    })
    .then(data => {
      this.elms.model_list.innerHTML = '';

      data.models.forEach(model => {
        if (model.model_type == 'main') {
          let option = document.createElement('option');
          option.value = JSON.stringify(model);
          option.innerHTML = model.model_name;
          this.elms.model_list.appendChild(option);
          this.getSaved('model') == JSON.stringify(model) ? this.elms.model_list.value = JSON.stringify(model) : null;
        }
      })
      this.initSocket(serverAddress);
    }).catch(error => {
      this.displayError(error);
    });
  },

  initSocket: function(serverAddress) {
    // open socket connection with socket.io
    var websocket = serverAddress.replace('http', 'ws');
    websocket = websocket.replace('https', 'wss');

    this.socket = io(websocket,{
      path: '/ws/socket.io',
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');

      this.socket.emit('subscribe_queue', { queue_id: this.config.queue_id });
    });

    this.socket.on('generator_progress', (data) => {
      this.generatorProgress = data.progress_image;
      let step = data.step;
      let totalSteps = data.total_steps;
      this.queueItemID = data.queue_item_id;
      this.elms.percentBar.style.width = Math.floor((step / totalSteps) * 100) + '%';
      this.elms.percentBar.style.border = '1px solid var(--ok-graphical-fg)';
      this.elms.cancel.disabled = false;
      this.elms.clear.disabled = false;
      this.generationPercentDone = Math.floor((step / totalSteps) * 100);

      console.log('generator_progress', data.step);

      if(!this.selectedImage) {
        this.elms.output.src = this.generatorProgress.dataURL;
        this.elms.output.style.display = 'block';
      }
    });

    this.socket.on('batch_enqueued', (data) => {
      console.log('batch_enqueued', data);
    });


    this.socket.on('queue_item_status_changed', (data) => {
      console.log('queue_item_status_changed', data);
      let pending = data.queue_status.pending;
      let pendingCount = document.getElementById('pending-count');
      let pendingText = document.getElementById('pending');

      if (pending > 0) {
        this.elms.cancel.disabled = false;
        this.elms.clear.disabled = false;
        pendingCount.style.backgroundColor = 'var(--warning-color)';
        pendingCount.style.color = 'black';
      } else {
        pendingCount.style.backgroundColor = 'var(--surface-color-1)';
        pendingCount.style.color = 'var(--text-color-1)';

        this.elms.cancel.disabled = true;
        this.elms.clear.disabled = true;
      }

      pendingText.innerHTML = pending;
    });

    this.socket.on('invocation_started', (data) => {
      var seed = parseInt(data.node.seed);
      this.elms.cancel.disabled = false;

      if(seed && this.elms.random.checked) {
        this.elms.seed.value = seed;
        this.saveThis({id: 'seed', value: seed});
      }
    });

    this.socket.on('invocation_complete', (data) => {
      this.generatorResult = data.result;

      if(this.generatorResult.image) {
        console.log('invocation_complete', data);
        this.elms.percentBar.style.width = '100%';

        this.selectedImage = null;

        var imageURL = serverAddress
          + '/api/v1/images/i/'
          + this.generatorResult.image.image_name
          + '/full';

        this.elms.output.src = imageURL;
        this.elms.output.style.display = 'block';

        this.fetchImages();
        setTimeout(() => {
          this.elms.percentBar.style.width = '0%';
        }
        , 2500);
      }
    });

    this.socket.on('invocation_error', (data) => {
      console.log('invocation_error', data);
      this.displayError(data.error_type);
    });
  },

  initPayload: function() {
    var seeds = [parseInt(this.config.seed)];

    if (this.config.random == 'true') {
      seeds = [];
      for (var i = 0; i < this.config.queue_size; i++) {
        let seed = Math.floor(Math.random() * 1000000000);
        seeds.push(seed);
      }
    } else {
      this.elms.queue_size.value = 1;
    }

    var prompt = this.config.positive_prompt;
    var model = JSON.parse(this.elms.model_list.value);

    var payload = {
      "queue_id": this.config.queue_id,
      "batch": {
        "data": [
          [
            { "node_path": "noise", "field_name": "seed", "items": seeds },
            { "node_path": "core_metadata", "field_name": "seed", "items": seeds }
          ],
          [
            {
              "node_path": "positive_conditioning",
              "field_name": "prompt",
              "items": [this.config.positive_prompt]
            },
            {
              "node_path": "core_metadata",
              "field_name": "positive_prompt",
              "items": [this.config.positive_prompt]
            }
          ]
        ],

        "graph": {
          "id": "text_to_image_graph",
          "nodes": {
            "main_model_loader": {
              "id": "main_model_loader",
              "is_intermediate": true,
              "use_cache": true,
              "model": {
                "model_name": model.model_name,
                "base_model": model.base_model,
                "model_type": model.model_type
              },
              "type": "main_model_loader"
            },
            "clip_skip": {
              "id": "clip_skip",
              "is_intermediate": true,
              "use_cache": true,
              "skipped_layers": 0,
              "type": "clip_skip"
            },
            "positive_conditioning": {
              "id": "positive_conditioning",
              "is_intermediate": true,
              "use_cache": true,
              "prompt": this.config.positive_prompt,
              "type": "compel"
            },
            "negative_conditioning": {
              "id": "negative_conditioning",
              "is_intermediate": true,
              "use_cache": true,
              "prompt": this.config.negative_prompt,
              "type": "compel"
            },
            "noise": {
              "id": "noise",
              "is_intermediate": true,
              "use_cache": true,
              "width": this.config.width,
              "height": this.config.height,
              "seed": parseInt(this.config.seed),
              "use_cpu": true,
              "type": "noise"
            },
            "denoise_latents": {
              "id": "denoise_latents",
              "is_intermediate": true,
              "use_cache": true,
              "steps": this.config.steps,
              "cfg_scale": this.config.cfg_scale,
              "denoising_start": 0,
              "denoising_end": 1,
              "scheduler": this.config.scheduler,
              "cfg_rescale_multiplier": 0,
              "type": "denoise_latents"
            },
            "latents_to_image": {
              "id": "latents_to_image",
              "is_intermediate": true,
              "use_cache": false,
              "tiled": false,
              "fp32": true,
              "type": "l2i"
            },
            "core_metadata": {
              "id": "core_metadata",
              "is_intermediate": false,
              "use_cache": true,
              "generation_mode": "txt2img",
              "negative_prompt": this.config.negative_prompt,
              "width": this.config.width,
              "height": this.config.height,
              "rand_device": "cpu",
              "cfg_scale": this.config.cfg_scale,
              "cfg_rescale_multiplier": 0,
              "steps": this.config.steps,
              "scheduler": this.config.scheduler,
              "clip_skip": 0,
              "model": {
                "model_name": model.model_name,
                "base_model": model.base_model,
                "model_type": model.model_type
              },
              "type": "core_metadata"
            },
            "linear_ui_output": {
              "id": "linear_ui_output",
              "is_intermediate": false,
              "use_cache": false,
              "type": "linear_ui_output"
            }
          },

          "edges": [
            {
              "source": { "node_id": "main_model_loader", "field": "unet" },
              "destination": { "node_id": "denoise_latents", "field": "unet" }
            },
            {
              "source": { "node_id": "main_model_loader", "field": "clip" },
              "destination": { "node_id": "clip_skip", "field": "clip" }
            },
            {
              "source": { "node_id": "clip_skip", "field": "clip" },
              "destination": { "node_id": "positive_conditioning", "field": "clip" }
            },
            {
              "source": { "node_id": "clip_skip", "field": "clip" },
              "destination": { "node_id": "negative_conditioning", "field": "clip" }
            },
            {
              "source": {
                "node_id": "positive_conditioning",
                "field": "conditioning"
              },
              "destination": {
                "node_id": "denoise_latents",
                "field": "positive_conditioning"
              }
            },
            {
              "source": {
                "node_id": "negative_conditioning",
                "field": "conditioning"
              },
              "destination": {
                "node_id": "denoise_latents",
                "field": "negative_conditioning"
              }
            },
            {
              "source": { "node_id": "noise", "field": "noise" },
              "destination": { "node_id": "denoise_latents", "field": "noise" }
            },
            {
              "source": { "node_id": "denoise_latents", "field": "latents" },
              "destination": { "node_id": "latents_to_image", "field": "latents" }
            },
            {
              "source": { "node_id": "core_metadata", "field": "metadata" },
              "destination": { "node_id": "latents_to_image", "field": "metadata" }
            },
            {
              "source": { "node_id": "main_model_loader", "field": "vae" },
              "destination": { "node_id": "latents_to_image", "field": "vae" }
            },
            {
              "source": { "node_id": "latents_to_image", "field": "image" },
              "destination": { "node_id": "linear_ui_output", "field": "image" }
            }
          ]
        },
        "runs": 1
      }
    };

    return payload;
  }
};

GOINVOKE.init();
