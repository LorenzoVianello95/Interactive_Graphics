'use-strict';

var container, stats

var camera, controls, scene, renderer;
var gui;
var startTime = Date.now();
var arms = [];
var spheres = [];
var piecesAdded = false;

var bones = []; // temporary
var meshes = [];

var params = {
	coverage: false,
};

var RobotArm = function(armLen) {
	THREE.Object3D.apply(this, arguments);
	var armGeometry = new THREE.CubeGeometry(0.2, armLen, 0.2);
	var armMesh = new THREE.Mesh(armGeometry, this.armMaterial);
	armMesh.position.y = armLen / 2;
	this.add(armMesh);
	this.armLen = armLen;
	this.childArm = null;

	this.addArm = function addArm(childArm) {
		childArm.position.y = this.armLen;
		this.childArm = childArm;
		this.add(childArm);
	}
}
RobotArm.prototype = Object.create(THREE.Object3D.prototype);
RobotArm.prototype.constructor = RobotArm;
RobotArm.prototype.armMaterial = new THREE.MeshLambertMaterial({
	color: 0xdd4411
});

window.addEventListener('load', init);

function init() {
	if (!Detector.webgl)
		Detector.addGetWebGLMessage();

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

	controls = new THREE.OrbitControls(camera);
	controls.addEventListener('change', render);
	// some custom control settings
	controls.enablePan = false;
	controls.minDistance = 2;
	controls.maxDistance = 10;
	controls.zoomSpeed = 2.0;
	controls.target = new THREE.Vector3(0, 2, 0);

	camera.position.x = 5;

	// world
	scene = new THREE.Scene();
	createArms();

	// lights
	var light = new THREE.DirectionalLight( 0xffffff );
	light.position.set( 10, 5, 15 );
	scene.add( light );

	light = new THREE.DirectionalLight( 0x444444 );
	light.position.set( -10, -5, -15 );
	scene.add( light );

	light = new THREE.AmbientLight( 0x444444 );
	scene.add( light );

	// renderer
	renderer = new THREE.WebGLRenderer( {antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );

	container = document.getElementById('container');
	container.appendChild(renderer.domElement);

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.zIndex = 100;
	container.appendChild( stats.domElement );

	window.addEventListener( 'resize', onWindowResize, false );

	gui = new dat.GUI();
	gui.add(params, 'coverage');
	gui.open();

	addSpheres();
	addArms();
	setupDatGui();

	onWindowResize();

	animate();
}

function createArms() {
	arms = [];
	arms[0] = new RobotArm(2);
	var prevArm = arms[0];
	for (var i = 1; i < 4; ++i) {
		arms[i] = new RobotArm(2);
		prevArm.addArm(arms[i]);
		prevArm = arms[i];
	}
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
	scene.add(arms[0]);
	spheres.forEach(function (sphere) {
		scene.add(sphere);
	});
}

// GUI

function setupDatGui () {

	var folder;
	//var bones = mesh.skeleton.bones;

	for ( var i = 0; i < arms.length; i ++ ) {

		var bone = arms[ i ];

		folder = gui.addFolder( "Bone " + i );

		folder.add( bone.position, 'x', - 10 + bone.position.x, 10 + bone.position.x );
		folder.add( bone.position, 'y', - 10 + bone.position.y, 10 + bone.position.y );
		folder.add( bone.position, 'z', - 10 + bone.position.z, 10 + bone.position.z );

		folder.add( bone.rotation, 'x', - Math.PI * 0.5, Math.PI * 0.5 );
		folder.add( bone.rotation, 'y', - Math.PI * 0.5, Math.PI * 0.5 );
		folder.add( bone.rotation, 'z', - Math.PI * 0.5, Math.PI * 0.5 );

		folder.add( bone.scale, 'x', 0, 2 );
		folder.add( bone.scale, 'y', 0, 2 );
		folder.add( bone.scale, 'z', 0, 2 );

		folder.__controllers[ 0 ].name( "position.x" );
		folder.__controllers[ 1 ].name( "position.y" );
		folder.__controllers[ 2 ].name( "position.z" );

		folder.__controllers[ 3 ].name( "rotation.x" );
		folder.__controllers[ 4 ].name( "rotation.y" );
		folder.__controllers[ 5 ].name( "rotation.z" );

		folder.__controllers[ 6 ].name( "scale.x" );
		folder.__controllers[ 7 ].name( "scale.y" );
		folder.__controllers[ 8 ].name( "scale.z" );

	}

}

// Render

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
		s.visible = params.coverage;
		s.position.x = Math.sin(dTime / 300);
	});
	renderer.render( scene, camera );
	stats.update();
}
