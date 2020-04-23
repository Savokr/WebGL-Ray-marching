var time = 0.0;

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);


  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);

  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function initBuffers(gl) {

  const positionBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [
    -1.0,  1.0,
     1.0,  1.0,
    -1.0, -1.0,
     1.0, -1.0];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
  };
}

function resize(canvas) {
    var displayWidth  = canvas.clientWidth;
    var displayHeight = canvas.clientHeight;

    if (canvas.width  !== displayWidth ||
        canvas.height !== displayHeight) {
      canvas.width  = displayWidth;
      canvas.height = displayHeight;
    }
  }

function drawScene(gl, programInfo, buffers, deltaTime) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  resize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //const fieldOfView = 45.0 * Math.PI / 180.0;  
  //const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  //const zNear = 1;
  //const zFar = 100.0;
  //const projectionMatrix = glMatrix.mat4.create();

  //glMatrix.mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  //const modelViewMatrix = glMatrix.mat4.create();

  time+= deltaTime;

  //glMatrix.mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -1]); 
  //glMatrix.mat4.rotate(modelViewMatrix, modelViewMatrix, squareRotation, [1,0,0]);

  {
    const numComponents = 2;  // pull out 2 values per iteration
    const type = gl.FLOAT;    // the data in the buffer is 32bit floats
    const normalize = false;  // don't normalize
    const stride = 0;         // how many bytes to get from one set of values to the next                          
    const offset = 0;         // how many bytes inside the buffer to start from
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, numComponents, type, normalize, stride, offset); 
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  gl.useProgram(programInfo.program);

  //gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  //gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
  gl.uniform3fv(programInfo.uniformLocations.cameraPosition, [6.*Math.sin(time/2.), 3., 6.*Math.cos(time/2.)]);
  gl.uniform2fv(programInfo.uniformLocations.resolution, [gl.canvas.clientWidth,gl.canvas.clientHeight]);
  gl.uniform3fv(programInfo.uniformLocations.lookAt, [0.,0.,0.]);

  {
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }
}

function main() {
  const canvas = document.querySelector("#glCanvas");
  const gl = canvas.getContext("webgl");
  if (gl === null) {
    alert("Sorry, no fun today!");
    return;
  }
  
  // Vertex shader GLSL code
  const vsSource = `
    attribute vec4 aVertexPosition;

    void main() {
      gl_Position = aVertexPosition;
    }
  `;
  // Fragment shader GLSL code
  const fsSource = `
precision mediump float;
uniform vec3 cameraPosition;
uniform vec3 lookAt;
uniform vec2 resolution;
const float EPS = 0.01;
const int MAX_STEP = 100;
const float ZOOM = 1.3;

float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

float sphereSDF(vec3 point, vec3 center, float radius) {
  return length(point - center) - radius;
}

float planeSDF(vec3 point, float height) {
  return point.y - height;
}

float boxSDF(vec3 point, vec3 bound)
{
  vec3 q = abs(point) - bound;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sceneSDF(vec3 point) {
  //point.xyz = mod(point.xyz+vec3(2.), vec3(4.)) - vec3(2.);
  float a = min(sphereSDF(point, vec3(0.,0.,0.), 1.4), sphereSDF(point, vec3(2.,1.5,3.), 1.));
  float b = min(min(boxSDF(point, vec3(999999999., 0.5, 0.5)), boxSDF(point, vec3(0.5,999999999., 0.5))), boxSDF(point, vec3(0.5,0.5,999999999.)) );
  return smin(a,b,0.3);
}

mat4 viewMatrix(vec3 eye, vec3 center, vec3 up) {
  vec3 f = normalize(center - eye);
  vec3 s = normalize(cross(f, up));
  vec3 u = cross(s, f);
  return mat4(
    vec4(s, 0.0),
    vec4(u, 0.0),
    vec4(-f, 0.0),
    vec4(0.0, 0.0, 0.0, 1)
  );
}

vec3 getNormal(vec3 point) {
  return normalize(vec3(sceneSDF(point + vec3(EPS,0.,0.)) - sceneSDF(point-vec3(EPS,0.,0.)), 
              sceneSDF(point + vec3(0.,EPS,0.)) - sceneSDF(point-vec3(0.,EPS,0.)), 
              sceneSDF(point + vec3(0.,0.,EPS)) - sceneSDF(point-vec3(0.,0.,EPS)) ) );
}


vec4 rayMarch(vec3 camera, vec3 dir) {
  vec3 point = camera;
  float leng = 0.0;
  for (int i=0;i<MAX_STEP;i++){
    leng = sceneSDF(point);
    if (leng <= EPS) {
      break;
    } else {
      point += dir*leng;
    }
  }
  return vec4(point,leng);
}

float getIllumination(vec3 point) {
  vec3 light = vec3(4.,4.,0.);
  vec3 normal = getNormal(point);
  float ill = clamp(dot(normal, normalize(light-point)), 0., 1.);
  float dist = length(rayMarch(point+normal*2.*EPS,normalize(light-point)).xyz-point);
  if (dist < length(light-point)) ill*= 0.1; else ill *=1.4;
  return ill; 
}

void main() {
  vec2 co = gl_FragCoord.xy/resolution*2.0 - 1.0;
  co.x *= resolution.x/resolution.y;
  vec3 cameraDirection = normalize(cameraPosition-lookAt);
  vec3 cameraRight = cross(cameraDirection, vec3(0.,-1.,0.));
  vec3 cameraUp = cross(cameraDirection, cameraRight);
  mat4 view = viewMatrix(cameraPosition, lookAt, cameraUp);
  
  vec3 rayDirection = normalize(vec3(co,-ZOOM));

  vec4 l = rayMarch(cameraPosition, normalize((view*vec4(rayDirection,0.)).xyz));
  vec3 color = (vec3(getIllumination(l.xyz)) + vec3(0.2))*vec3(0.4,0.5,0.6);
  if (l.w <= EPS) gl_FragColor = vec4(color,1.); else gl_FragColor = vec4(0.,0.,0.,1.0);
}
  `; 

  const shaderProgram = initShaderProgram(gl,vsSource,fsSource)
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      //projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      //modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      cameraPosition: gl.getUniformLocation(shaderProgram, 'cameraPosition'),
      resolution: gl.getUniformLocation(shaderProgram, 'resolution'),
      lookAt: gl.getUniformLocation(shaderProgram, 'lookAt'),
    },
  };
  
  const buffers = initBuffers(gl);
  
  var time = 0.0;
  
  function render(now) {
  	now *= 0.001;
	const deltaTime = now - time;
	time = now;
	drawScene(gl, programInfo, buffers, deltaTime);

  	requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

window.onload = main;
