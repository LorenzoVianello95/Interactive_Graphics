'use-strict';


var container, stats

var camera, controls, scene, renderer;

var startTime = Date.now();
var arms = [];
var spheres = [];
var piecesAdded = false;

init();
render();

function init() {
	if (!Detector.webgl)
		Detector.addGetWebGLMessage();

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

	controls = new THREE.OrbitControls(camera);
	controls.addEventListener('change', render);
	// some custom control settings
	controls.enablePan = false;
	controls.minDistance = 2;
	controls.maxDistance = 160;
	controls.zoomSpeed = 2.0;

	//camera.position.z = 20;

	// world
	scene = new THREE.Scene();
	createArms();

	// lights
	var light = new THREE.DirectionalLight( 0xffffff );
	light.position.set( 1, 1, 1 );
	scene.add( light );

	light = new THREE.DirectionalLight( 0x002288 );
	light.position.set( -1, -1, -1 );
	scene.add( light );

	light = new THREE.AmbientLight( 0x222222 );
	scene.add( light );

	// renderer
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	
	container = document.getElementById('container');
	container.appendChild(renderer.domElement);

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.zIndex = 100;
	container.appendChild( stats.domElement );

	window.addEventListener( 'resize', onWindowResize, false );

	addSpheres();
	addArms();

	animate();
}

function createArms() {
	// DEBUG: Loading stats
	// var manager = new THREE.LoadingManager();
	// manager.onProgress = function ( item, loaded, total ) {
	// 	console.log( item, loaded, total );
	// };

	var armMaterial = new THREE.MeshLambertMaterial({color: 0xdd4411});

	// DEBUG: Another stats and error reporting
	// var onProgress = function ( xhr ) {
	// 	if ( xhr.lengthComputable ) {
	// 		var percentComplete = xhr.loaded / xhr.total * 100;
	// 		console.log( Math.round(percentComplete, 2) + '% downloaded' );
	// 	}
	// };

	// var onError = function ( xhr ) {
	// 	console.log("Error loading: ");
	// };

	arms[0] = new THREE.Mesh(new THREE.CubeGeometry(1, 0.2, 0.2), armMaterial);
}

function addSpheres() {
	//var sphereMat = new THREE.MeshLambertMaterial({color: 0xff5500, transparent: true, opacity: 0.5});
	var sphereMat = new THREE.MeshLambertMaterial({color: 0xff0000, transparent: true, opacity: 0.5});
	var sphMesh = new THREE.Mesh( new THREE.SphereGeometry(0.5, 16, 16), sphereMat);
	sphMesh.position.y = 2;
	spheres.push(sphMesh);
	for (var i = 0; i < 100; ++i) {
		var copySphere = sphMesh.clone();
		copySphere.position.y -= 0.5 * (i + 1);
		spheres.push(copySphere);
	}
}

function addArms() {
	arms.forEach(function (arm) {
		scene.add(arm);
	});
	spheres.forEach(function (sphere) {
		scene.add(sphere);
	});
}

function animate() {
	render();
	requestAnimationFrame(animate);
	controls.update();
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
	render();
}

function render() {
	//addArms();
	var dTime = Date.now() - startTime;
	spheres.forEach(function (s) {
		s.position.x = Math.sin(dTime / 300);
	})
	renderer.render( scene, camera );
	stats.update();
}
