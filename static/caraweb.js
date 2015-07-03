    var video = document.querySelector('#live');
    w = 320;
    h = 240;
    video.width = w;
    video.height = h;
    var canvas = document.querySelector('#canvas');
    var divCaras = document.querySelector('#corposActuales');
    var fps = 1;
    var noDetectadas = 0;
    var ctx = canvas.getContext('2d');
    var mainTimer;
    var corpos = [];
    var ultimoCorpo = undefined;
    var bgPixels = undefined;
    var bgGray = undefined;

    var diffMode = 4;

    var applyThreshold = true;
    var threshold = 100;

    var applyFlood = true;
    var floodLimit = 30;
    var colorThreshold = 10;

    var adjustMultiplier = 2;
    var adjustThreshold = 60;

    var erodes = 0;
    
    var blurSize = 0;

    var viewMode = 1;

    var debug = document.querySelector('#debug');
    var debugBtn = document.querySelector('#debugBtn');
    var bgBtn = document.querySelector('#bgBtn');

    navigator.getMedia = (navigator.getUserMedia ||
                           navigator.webkitGetUserMedia ||
                           navigator.mozGetUserMedia ||
                           navigator.msGetUserMedia);

    navigator.getMedia({ video: true, audio: false }, function(stream) {
      video.src = window.URL.createObjectURL(stream);
    }, function (err) { console.error(err); });

    debugBtn.onclick = function (e) {
      e.preventDefault();
      if (debugBtn.className != 'round alert') {
        debugBtn.innerHTML = 'Detener Debug';
        debugBtn.className = 'round alert';
        debug.style.display = 'block';
      } else {
        debug.style.display = 'none';
        debugBtn.className = 'round success';
        debugBtn.innerHTML = 'Iniciar Debug';
      }
    }

    function grayBlurData(image) {
      gray = new jsfeat.matrix_t(w, h, jsfeat.U8_t | jsfeat.C1_t);
      jsfeat.imgproc.grayscale(image, w, h, gray);
      jsfeat.imgproc.gaussian_blur(gray, gray, blurSize);
      gray = gray.data;
      return gray;
    }

    bgBtn.onclick = function (e) {
      ctx.drawImage(video, 0, 0, w, h);
      bg = ctx.getImageData(0, 0, w, h).data;
      bgPixels = bg;
      bgGray = grayBlurData(bg);
    }

    var socket = io.connect(top.location.origin); // 'http://localhost');
    socket.on('corpos', function (_corpos) {
      // console.log(_corpos)
      if (!_corpos || _corpos.length === 0) {
        if (++noDetectadas > 10) {
          noDetectadas = 0;
          corpos = [];
        }
        return;
      }
      corpos = _corpos;
      if (debugBtn.className == 'round alert') {
        debug.innerHTML = JSON.stringify({fps:fps, corpos: { total: corpos.length, data: corpos}});
      }
      //// Intenta Quitar el tembeleque
      // corpos = _corpos.map(function (corpo) {
      //   corpo.x = Math.floor(corpo.x / 10) * 10;
      //   corpo.y = Math.floor(corpo.y / 10) * 10;
      //   corpo.width = Math.floor(corpo.width / 20) * 20;
      //   corpo.height = Math.floor(corpo.height / 20) * 20;
      //   return corpo;
      // });
    }).on('disconnect', function (data) {
      console.log("Disconnected!!!", data);
    });
    function calcAdjust(imageLength, imageGray) {
      var adjust = 0;
      var adjustCounter = 0;
      for (i = 0; i < imageLength; i++) {
        var x = i % w;
        var y = i / w;
	var p = h / 6;
        if ((y <= p) && (x <= p || x >= w - p)) {
          var aux = imageGray[i];
          var auxBg = bgGray[i];
          var d = (aux - auxBg);
          if (d < adjustThreshold) {
            adjust += d / 1000.0;
            adjustCounter++;
          }
	}
      }
      if (adjustCounter > 0)
        adjust = -adjust / adjustCounter * 1000;
      return adjust * adjustMultiplier;
    }
    function calcDiff(imagePixels, imageGray, bgPixels, bgGray, i, min, max, adjust) {
      var d = (imageGray[i]-min)*255/max;
      var bg = (bgGray[i]-min)*255/max;
      var diff0 = Math.abs(bg - adjust - d);
      var diffR = (bgPixels[i*4] - imagePixels[i*4]);
      var diffG = (bgPixels[i*4+1] - imagePixels[i*4+1]);
      var diffB = (bgPixels[i*4+2] - imagePixels[i*4+2]);

      if (diffMode == 1) {
        diff0 = (diff0 + Math.abs(0.299 * diffR + 0.587 * diffG + 0.114 * diffB - adjust / 3)) / 2;
      } else if (diffMode == 2) {
        diff0 = Math.abs(0.299 * diffR + 0.587 * diffG + 0.114 * diffB - adjust);
      } else if (diffMode == 3) {
        diff0 = (diff0 + Math.abs(0.299 * diffR + 0.587 * diffG + 0.114 * diffB - adjust / 3) * 2) / 2.2;
      } else if (diffMode == 4) {
        diff0 = (2 * diff0 + Math.abs(0.299 * diffR + 0.587 * diffG + 0.114 * diffB - adjust / 3)) / 2.5;
      } else if (diffMode == 5) {
        diff0 = Math.abs(bg - d + adjust);
      }
      if (diff0 > 255)
        return 255;
      else if (diff0 < 0)
        return 0;
      else
        return diff0;
    }
    function diff(imagePixels, imageGray, bgPixels, bgGray, applyThreshold) {
      var imageDiff = new jsfeat.matrix_t(w, h, jsfeat.U8_t | jsfeat.C1_t);

      var imageLength = imageGray.length;
      var min = 10000;
      var max = 0;

      for (i = 0; i < imageLength; i++) {
        var aux = imageGray[i];
        if (aux < min) min = aux;
	else if (aux > max) max = aux;
      }

      var adjust = calcAdjust(imageLength, imageGray);
      console.log("Adjust brigth difference: " + adjust);

      if (applyThreshold) {
        for (i = 1; i < imageLength; i++) {
          imageDiff[i] = calcDiff(imagePixels, imageGray, bgPixels, bgGray, i, min, max, adjust);
	  imageDiff[i] = imageDiff[i] > threshold ? 255 : 0;
	}
      } else {
        for (i = 1; i < imageLength; i++) {
          imageDiff[i] = calcDiff(imagePixels, imageGray, bgPixels, bgGray, i, min, max, adjust);
	}
      }

      return imageDiff;
    }

    var Color = function(cR, cG, cB) {
      this.red = cR;
      this.green = cG;
      this.blue = cB;
      this.equals = function(color) {
        var dR = Math.abs(this.red - color.red);
        var dG = Math.abs(this.green - color.green);
        var dB = Math.abs(this.blue - color.blue);
        return dR < colorThreshold / 2 && dG < colorThreshold && dB < colorThreshold / 1.5;
      }
      this.to_s = function() {
	      return this.red + "," + this.green + "," + this.blue;
      }
    }
    function getColor(image, x, y) {
      var i = (y * w + x) * 4;
      var cR = image.data[i];
      var cG = image.data[i+1];
      var cB = image.data[i+2];
      return new Color (cR, cG, cB);
    }
    function floodFill(image, mask, x, y, newC) {
      var mainC = getColor(image, x, y);
      var i = (y * w + x);
      mask[i] = newC;
      floodFill4(image, mask, x + 1, y, mainC, newC, 0);
      floodFill4(image, mask, x - 1, y, mainC, newC, 0);
      floodFill4(image, mask, x, y + 1, mainC, newC, 0);
      floodFill4(image, mask, x, y - 1, mainC, newC, 0);
    }
    function flood(imageData, mask) {
      if (applyFlood && applyThreshold) {
        for (x = 0; x < w; x++) {
          for (y = 0; y < h; y++) {
            var i = y * w + x;
            if (mask[i] == 255) {
              floodFill(imageData, mask, x, y, 255);
            }
          }
        }
      }
    }
    function floodFill4 (image, mask, x, y, mainC, newC, count) {
      if (x > w || y > h || y < 0 || x < 0 || !applyFlood || count > floodLimit)
        return;

      var i = (y * w + x);
      var maskColor = mask[i];
      var diffC = Math.abs(maskColor - newC);
      if (maskColor != 255 && maskColor != newC) {
        var color = getColor(image, x, y);
        if(color.equals(mainC)) {
		if (diffC == 0) {
			mask[i] = 255;
		} else {
			mask[i] = newC;
		}
          //mask[i] = newC;
          if (count < floodLimit) {
            floodFill4(image, mask, x + 1, y, color, newC, count + 1);
            floodFill4(image, mask, x - 1, y, color, newC, count + 1);
            floodFill4(image, mask, x, y + 1, color, newC, count + 1);
            floodFill4(image, mask, x, y - 1, color, newC, count + 1);
          }
        }
      }
    }
    function doThreshold(image, threshold) {
      for (i = 0; i < image.length; i++) {
        image[i] = (image[i] > threshold) ? 255 : 0;
      }
    }
    function applyViewMode(imageData, map, mode) {
      if (mode == 1) {
        for (i = 0; i < imageData.data.length; i+=4) {
          x = map[i / 4];
          imageData.data[i] = x;
          imageData.data[i+1] = x;
          imageData.data[i+2] = x;
        }
      } else if (mode == 2) {
        for (i = 0; i < imageData.data.length; i+=4) {
          x = map[i / 4] / 255.0;
	  if (x < 0) x = 0;
	  if (x > 255) x = 255;
          imageData.data[i] *= x;
          imageData.data[i+1] *= x;
          imageData.data[i+2] *= x;
        }
      } else if (mode == 3) {
        for (i = 0; i < imageData.data.length; i+=4) {
          x = 255.0 - map[i / 4];
	  if (x < 0) x = 0;
	  if (x > 255) x = 255;
          imageData.data[i] += x;
          imageData.data[i+1] += x;
          imageData.data[i+2] += x;
        }
      } else if (mode == 4) {
        for (i = 0; i < imageData.data.length; i+=4) {
          x = 255.0 - map[i / 4];
	  if (x < 0) x = 0;
	  if (x > 255) x = 255;
	  if (x > 0) {
            imageData.data[i] = bgPixels[i];
            imageData.data[i+1] = bgPixels[i+1];
            imageData.data[i+2] = bgPixels[i+2];
	  } else {
            imageData.data[i] += x;
            imageData.data[i+1] += x;
            imageData.data[i+2] += x;
	  }
        }
      }
    }
    function erode(mask, n) {
      var orig = new CV.Image(w,h,mask);
      var dst = orig;
      for (i = 0; i < n; i++) {
        dst = new CV.Image();
        CV.erode(orig, dst);
        orig = new CV.Image(w,h,dst.data);
      }
      for (i = 0; i < mask.length; i++) {
        mask[i] = dst[i];
      }
    }

    function proccess() {
      ctx.drawImage(video, 0, 0, w, h);
      if (!bgGray) return;
      imageData = ctx.getImageData(0, 0, w, h);

      imagePixels = imageData.data;
      imageGray = grayBlurData(imagePixels);
      imageLength = imageGray.length;

      imageDiff = diff(imagePixels, imageGray, bgPixels, bgGray, applyThreshold);
      erode(imageDiff, erodes);
      
      flood(imageData, imageDiff);
      applyViewMode(imageData, imageDiff, viewMode);
      
      ctx.putImageData(imageData, 0, 0);
    }

    function captura () {      
      mainTimer = setInterval(function () {
	proccess();

        if (corpos && corpos.length) {
          divCaras.innerHTML = '';
          for (var i in corpos) {
            var corpo = corpos[i];
            var _corpo = document.createElement('canvas');
            // Fotica por individuo
            divCaras.appendChild(_corpo);
            _corpo.width = 64;
            _corpo.height = 64;
            _corpo.getContext('2d').drawImage(canvas, corpo.x, corpo.y, corpo.width, corpo.height, 0, 0, 64, 64);

            // Marco de Cara
	    /*if (ultimoCorpo != undefined) {
		    corpo.x = (ultimoCorpo.x + corpo.x) / 2;
		    corpo.y = (ultimoCorpo.y + corpo.y) / 2;
		    corpo.height = (ultimoCorpo.height + corpo.height) / 2;
		    corpo.width = (ultimoCorpo.width + corpo.width) / 2;
	    }*/
            ctx.beginPath();
            ctx.rect(corpo.x, corpo.y, corpo.width, corpo.height);
            ctx.fillStyle = 'rgba(46, 166, 203, 0.5)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#2ba6cb';
            ctx.stroke();

	    ctx.font = "12px verdana";
	    ctx.textBaseline = "hanging";
            ctx.fillStyle = 'rgb(46, 166, 203)';
	    ctx.fillText("Corpo", corpo.x + 5, corpo.y + 5);
            // Marco de olhos
            if (corpo.faces && corpo.faces.length > 0) {
              face = corpo.faces[0];
              ctx.beginPath();
              ctx.rect(face.x, face.y, face.width, face.height);
              ctx.fillStyle = 'transparent';
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = '#cb2ba6';
              ctx.stroke();

              ctx.fillStyle = 'rgb(203, 46, 166)';
	      ctx.fillText("Face", face.x + 5, face.y + 5);

              if (corpo.faces[0].olhos) {
                for (var olho in corpo.faces[0].olhos) {
                  olho = corpo.faces[0].olhos[olho];
                  ctx.beginPath();
                  ctx.rect(olho.x, olho.y, olho.width, olho.height);
                  ctx.fillStyle = 'transparent';
                  ctx.fill();
                  ctx.lineWidth = 2;
                  ctx.strokeStyle = '#a6cb2b';
                  ctx.stroke();
                }
              }
            }
          }
        }
        socket.emit('frame', canvas.toDataURL("image/jpeg"));
      }, 1000 / fps);
    }
    captura();
