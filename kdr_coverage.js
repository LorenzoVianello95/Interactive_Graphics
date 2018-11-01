'use-strict';

// monkey-patch dat.GUI

dat.GUI.prototype.removeFolder = function (fldl) {
	var name = fldl.name;
	var folder = this.__folders[name];
	if (!folder) {
		return;
	}
	folder.close();
	this.__ul.removeChild(folder.domElement.parentNode);
	delete this.__folders[name];
	this.onResize();
}

// global variables

var container, stats

var camera, controls, scene, renderer;
var gui;
var startTime = Date.now();
var arms = [];
var armGuiFolders = [];
var baseArm = null;
var spheres = [];
var particles = null;
var coverageDirtyPos = true;
var coverageDirtyCount = true;
var coverageDirtyTransparency = false;
var coveragePositions = [];

var sphere0;
var sphere1;
var sphere2;

// some constants
const epsilon = 1e-6;
const coverageParticleSize = 0.5;
const maxPrecision = 32;
const maxBasePrecision = 64;

var params = {
	coverage: false,
	coverageType: 'particles',
	coverageTransparent: false,
	coverageDiscrete: false,
	coveragePrecision: 8,
	coverageScale: 0.5,
	basePrecision: 0,
	armCount: 3,
	robotScale: 1,
	robotColor: '#dd4411',
	coverageColor: '#ff0000'
};

var currentParams = {
	armCount: 0,
	coverageType: '',
	minDim: 0
};

var RobotArm = function(armLen, createMesh = true, firstArm = false, endPointArm = false) {
	THREE.Object3D.apply(this, arguments);
	if (createMesh) {
		var armGeometry = new THREE.CylinderGeometry(0.13, 0.13, 1, 16, 4, false );
		
		this.armMesh = new THREE.Mesh(armGeometry, this.armMaterial);
		this.armMesh.scale.x = params.robotScale;
		this.armMesh.scale.y = armLen;
		this.armMesh.scale.z = params.robotScale;
		this.armMesh.position.y = armLen / 2;
		this.add(this.armMesh);

		if(!endPointArm){
			var cg = new THREE.SphereGeometry(0.2, 32, 32  );
			cg.rotateZ(-Math.PI * 0.5);
				//cg.position.y += 0.1;
			cg.translate(0, 0.5, 0);
				//for(var i = 0 ; i < armGeometry.vertices.length; i++) armGeometry.vertices[i].position.y -= 0.5;
			var materialGiunti= new THREE.MeshStandardMaterial( {
																color: 0xffffff,
																roughness: 0.7,
															    metalness: 0.4,
															} );
			var cMesh=new THREE.Mesh(cg, materialGiunti);
			this.armMesh.add(cMesh);
			if(firstArm){
					//console.log(13);
					var cgBase = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16, 4, false );
					cgBase.translate(0, -0.45, 0);
					var cMesh=new THREE.Mesh(cgBase, materialGiunti);
					this.armMesh.add(cMesh);
					var cgBase = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16, 4, false );
					cgBase.translate(0, -0.4, 0);
					var cMesh=new THREE.Mesh(cgBase, materialGiunti);
					this.armMesh.add(cMesh);
				}
		}

	}
	this.armLen = armLen;
	this.childArm = null;
	this.constraint = {
		min: -Math.PI / 2,
		max: Math.PI / 2
	}

	this.addArm = function addArm(childArm) {
		childArm.position.y = this.armLen;
		this.childArm = childArm;
		this.add(childArm);
	}

	this.cloneArm = function cloneArm() {
		console.log(9);
		var base = new RobotArm(this.armLen, false);
		base.rotation = this.rotation;
		base.constraint = this.constraint;
		if (this.childArm) {
			base.addArm(this.childArm.cloneArm());
		}
		return base;
	}

	this.getLastChild = function getLastChild() {
		if (this.childArm) {
			var desc = this.childArm;
			while(desc.childArm) {
				desc = desc.childArm;
			}
			return desc;
		} else {
			return this;
		}
	}

	this.updateArmLength = function updateArmLength() {
		if (this.childArm) {
			this.childArm.position.y = this.armLen;
		}
		if (this.armMesh) {
			this.armMesh.scale.y = this.armLen;
			this.armMesh.position.y = this.armLen / 2;
		}
	}

	this.updateConstraints = function updateConstraints(vertical) {
		if (vertical) {
			this.rotation.y = Math.min(Math.max(this.rotation.y, this.constraint.min), this.constraint.max);
		} else {
			this.rotation.x = Math.min(Math.max(this.rotation.x, this.constraint.min), this.constraint.max);
		}
	}

	this.getCombinedArmLength = function getCombinedArmLength() {
		if (!this.childArm) {
			return this.armLen;
		} else {
			return this.armLen + this.childArm.getCombinedArmLength();
		}
	}
}
RobotArm.prototype = Object.create(THREE.Object3D.prototype);
RobotArm.prototype.constructor = RobotArm;
RobotArm.prototype.armMaterial = new THREE.MeshLambertMaterial();

//RobotArm.prototype.armMaterial.transparent = true;		//SE NON VUOI LA TRASPARENZA CANCELLA QUESTE TRE LINEE
//RobotArm.prototype.armMaterial.opacity= 0.5;
//RobotArm.prototype.armMaterial.depthWrite= false;

RobotArm.prototype.armMaterial.color = new THREE.Color(parseInt(params.robotColor.replace('#', '0x')));

function changeRobotColor() {
	RobotArm.prototype.armMaterial.color = new THREE.Color(parseInt(params.robotColor.replace('#', '0x')));
}

function changeRobotScale() {
	baseArm.armMesh.scale.x = params.robotScale;
	baseArm.armMesh.scale.z = params.robotScale;
	var descending = baseArm.childArm;
	while(descending) {
		descending.armMesh.scale.x = params.robotScale;
		descending.armMesh.scale.z = params.robotScale;
		descending = descending.childArm;
	}
}

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

	camera.position.x = 3;
	camera.position.y = 3;
	camera.position.z = 3;

	// world
	scene = new THREE.Scene();

	//plan
	var loader = new THREE.TextureLoader();
	var texture = loader.load( 'model/tile-floor01.jpg');
	var geo = new THREE.PlaneBufferGeometry(5, 5, 32);
	var mat = new THREE.MeshBasicMaterial({ 
											map: texture,
											//color: 0xa6cfe2,
    										side: THREE.DoubleSide,
    										transparent: true,
    										opacity: 0.9,
    										depthWrite: false});
	var plane = new THREE.Mesh(geo, mat);
	plane.rotateX( - Math.PI / 2);
	scene.add(plane);

	// ripiani	
	var objectLoader = new THREE.ObjectLoader();
	objectLoader.load("model/shelf-metal.json", function ( obj ) {
		obj.translateZ(-1.5);
		obj.scale.set(2,2,2);
		scene.add( obj );
	} );

	//table
	var objectLoader = new THREE.ObjectLoader();
	objectLoader.load("model/table.json", function ( obj ) {
		obj.translateZ(1.5);
		obj.translateY(0.6);
		obj.scale.set(1.5,1.5,1.5);
		scene.add( obj );
	} );

	//bowl
	var objectLoader = new THREE.ObjectLoader();
	objectLoader.load("model/bowl.json", function ( obj ) {
		obj.translateX(1.5);
		obj.translateY(0.25);
		//obj.scale.set(1.5,1.5,1.5);
		//scene.add( obj );
	} );

	//objects to move
	var geometry = new THREE.SphereGeometry( 0.1, 32, 32 );
	geometry.translate(0.5,1.03,-2)
	var material = new THREE.MeshLambertMaterial( {color: 0xf92c32} );
	sphere0 = new THREE.Mesh( geometry, material );			// ripiano in basso
	scene.add( sphere0 );

	var geometry = new THREE.SphereGeometry( 0.1, 32, 32 );
	geometry.translate(-0.5,1.74,-2)
	var material = new THREE.MeshLambertMaterial( {color: 0xf92c32} );//0x48f31d
	sphere1 = new THREE.Mesh( geometry, material );
	scene.add( sphere1 );									// ripiano in alto

	var geometry = new THREE.SphereGeometry( 0.1, 32, 32 );
	geometry.translate(-0.5,1.31,2)
	var material = new THREE.MeshLambertMaterial( {color: 0xf92c32} );//0x5db8e0
	sphere2 = new THREE.Mesh( geometry, material );
	scene.add( sphere2 );									// sopra il tavolo

	//axis
	var axesHelper = new THREE.AxisHelper( 5 );
	scene.add( axesHelper );

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

	updateScene();

	onWindowResize();

	animate();
}

function createArms(armCount) {
	var baseRotation = 0;
	var baseConstraint = null;
	var armParams = [];
	console.log(9);
	if (null != baseArm) {
		console.log(9);
		arms.forEach(function(arm) {
			armParams.push({
				armLen: arm.armLen,
				rotation: arm.rotation.x,
				constraint: arm.constraint
			});
			delete arm;
		});
		baseRotation = baseArm.rotation.y;
		baseConstraint = baseArm.constraint;
		delete baseArm;
	}
	arms = [];
	baseArm = new RobotArm(1, true, true); 		//COSTRISCO IL BRACCIO DI BASE
	baseArm.rotation.y = baseRotation;
	if (baseConstraint) {
		baseArm.constraint = baseConstraint;
	}
	var prevArm = baseArm;
	for (var i = 0; i < armCount; ++i) {
		if(i==armCount-1){							//costruisco l'ultimo braccio
			arms[i] = new RobotArm(1,true,false,true);
			prevArm.addArm(arms[i]);
			prevArm = arms[i];
		}else{										// costruisco le braccia intermedie
			arms[i] = new RobotArm(1);
			prevArm.addArm(arms[i]);
			prevArm = arms[i];
		}
	}

	var minSize = Math.min(armParams.length, armCount);
	for (var i = 0; i < minSize; ++i) {
		arms[i].armLen = armParams[i].armLen;
		console.log(9);
		arms[i].rotation.x = armParams[i].rotation;
		arms[i].constraint = armParams[i].constraint;
	}
	updateArmLengths();
	// also set the dirty sphere count
	coverageDirtyCount = true;
}

function updateArmLengths() {
	arms.forEach(function(arm) {
		arm.updateArmLength();
	});
	coverageDirtyPos = true;
}

function updateScene() {
	var armsUpdated = false;
	if (currentParams.armCount != params.armCount) {
		if (null != baseArm) {
			scene.remove(baseArm);
		}
		//console.log(1111)
		createArms(params.armCount);
		scene.add(baseArm); // created by createArms(..)
		currentParams.armCount = params.armCount;
		armsUpdated = true;
	}
	if (armsUpdated) {
		updateDatGui();
	}
}		


var totPath= [	[0,4,0], // posizione iniziale
				 [-0.5,1.31,2], // oggetto palla azzurra
				 [-1,2,0], // posizione intermedia tra palla azzurra e palla verde
				 [-0.5,1.74,-2],	// palla verde
				 [0,1.74,-1],		//punto tra palla verde e rossa
				 [0.5,1.03,-2],			//palla rossa
				 [0.4,1.1,-1],
				 [0,4,0]
			];
var totOrient=[[0,1,0], // posizione iniziale
				[-1,-1,0], // oggetto palla azzurra
				[0,0,-1],	// posizione intermedia tra palla azzurra e palla verde
				[1,-0.5,0],	// palla verde
				[0.5,-0.5,-0.5],	//punto tra palla verde e rossa
				[0.1,-0.5,-1],	//palla rossa
				[0.2,-0.5,-0.5],
				[0,1,0]
			  ];
//-0.5,1.31,2

// plan execution variables 
var kin= true;
var pathNumber=0;
var done= false;
var numIteration=0;

var initialPosition = [0,4,0];//[2.5, 1, 0];

var initialOrientation= [0,1,0];//[1,1,2]; // non normalizzata


// funzione che ritorna dove si trova al tempo t l'end effector e con quale orientazione
function calculatepathPoseAtTime(p0, o0, p1,o1, t){
	var x0= p0[0];
	var y0= p0[1];
	var z0= p0[2];

	var x1= p1[0];
	var y1= p1[1];
	var z1= p1[2];

	var tOrientation=t;

	var endEffVelocity= 0.02;

	var pathLength=Math.sqrt(Math.pow(x1-x0 , 2) + Math.pow(y1-y0 , 2) + Math.pow(z1-z0,2));
	var totalTime= pathLength/endEffVelocity;

	t=t/totalTime;
	//console.log(t)
	if(t>=1){
		console.log("finished phase"+pathNumber)
		if(pathNumber==0){
				sphere2.material.color.setHex( 0x48f31d );
		}else if(pathNumber==2){
			sphere1.material.color.setHex( 0x48f31d );
		}else if(pathNumber==4){
			sphere0.material.color.setHex( 0x48f31d );
		}

		done=true;
		pathNumber+=1;
	}

	// calcolo x al tempo t con un equazione del terzo grado ponendo 
	// x(T) = x1 , x(0)=x0 , x'(T)=0 ,x'(0)=0
	var xAtTime_t = x0 + 3*(x1-x0)*t*t - 2*(x1-x0)*t*t*t ;

	// coeficenti di z(x) e y(x), che sono equazioni lineari nella forma y= mx+q
	var m_y = (y1-y0)/(x1-x0);
	//console.log("my"+m_y)
	var m_z = (z1-z0)/(x1-x0);
	//console.log("mz"+m_z)
	var q_y = -m_y*x0+y0;
	//console.log("qy"+q_y)
	var q_z = -m_z*x0+z0;
	//console.log("qz"+q_z)

	var yAtTime_t = m_y*xAtTime_t + q_y ;
	var zAtTime_t = m_z*xAtTime_t + q_z ;

	var positionAtTime_t=[xAtTime_t , yAtTime_t , zAtTime_t];

	// ora rifaccio tutto per l'orientamento:
	if(o0==o1){
		var orientationAtTime_t=o0;
	}else{

		x0= o0[0];
		y0= o0[1];
		z0= o0[2];

		x1= o1[0];
		y1= o1[1];
		z1= o1[2];

		//t= tOrientation;

		//endEffVelocity= 0.02;

		//pathLength=Math.sqrt(Math.pow(x1-x0 , 2) + Math.pow(y1-y0 , 2) + Math.pow(z1-z0,2));
		//totalTime= pathLength/endEffVelocity;

		//t=t/totalTime;
		//console.log(t)

		// calcolo x al tempo t con un equazione del terzo grado ponendo 
		// x(T) = x1 , x(0)=x0 , x'(T)=0 ,x'(0)=0
		xAtTime_t = x0 + 3*(x1-x0)*t*t - 2*(x1-x0)*t*t*t ;

		// coeficenti di z(x) e y(x), che sono equazioni lineari nella forma y= mx+q
		m_y = (y1-y0)/(x1-x0);
		//console.log("my"+m_y)
		m_z = (z1-z0)/(x1-x0);
		//console.log("mz"+m_z)
		q_y = -m_y*x0+y0;
		//console.log("qy"+q_y)
		q_z = -m_z*x0+z0;
		//console.log("qz"+q_z)

		yAtTime_t = m_y*xAtTime_t + q_y ;
		zAtTime_t = m_z*xAtTime_t + q_z ;

		var orientationAtTime_t=[xAtTime_t , yAtTime_t , zAtTime_t];
	}
	return [positionAtTime_t, orientationAtTime_t];
}

// kinematica fatta per 4 DOF quindi posso utilizzarla solo per scegliere la posizione 
// dell end effector e l'orientamento rispetto all'asse delle y non riespetto agli altri due assi
function inverseKinematics(position, orientation){
	//tell if the position point is inside the WS:
	var distEndEffector= Math.sqrt(Math.pow(position[0],2)+Math.pow(position[1]-1,2)+ Math.pow(position[2],2));
	if (distEndEffector>= 3 || position[1]<0){
		console.log("OUT OF WS")
		return [0,0,0,0];
		kin=false;
	}

	//normalize orientation
	var lenVectOrientation=0;
	for (var i = orientation.length - 1; i >= 0; i--) {
		lenVectOrientation+= Math.pow ( orientation[i],2 );
	}
	lenVectOrientation= Math.sqrt(lenVectOrientation);
	//console.log("K"+lenVectOrientation) 
	for (var i = orientation.length - 1; i >= 0; i--) {
		orientation[i]/=lenVectOrientation;
	}
	//console.log(orientation) 
	//start calculating the angles
	var s123= Math.sqrt(orientation[0]*orientation[0]+orientation[2]*orientation[2]);
	var beta = Math.atan2(position[0],position[2]);//Math.atan2(position[2],position[0]);
	var x= position[0]/ Math.sin(beta);
	x= x-s123;
	var y= position[1]- 1 - orientation[1];

	var c2= (Math.pow(x,2)+Math.pow(y,2)-2)/2;
	var s2= Math.sqrt(1-Math.pow(c2,2));	// qui ci sarebbero due soluzioni
	var theta2= Math.atan2(s2,c2);

	var s1=((1+c2)*x - y*s2) / (x*x+y*y);
	var c1=((1+c2)*y + s2*x) / (x*x+y*y);
	var theta1= Math.atan2(s1,c1);

	// questo passaggio serve per dire che posso calcolare solo l'orientamento risp a y	
	var sum= Math.atan2(s123 , orientation[1]);
	var theta3= sum - theta1 - theta2;

	return [beta, theta1, theta2, theta3];
}

function uptadeMovement(t){
	//console.log(t);
	if (pathNumber< totPath.length-1){
		done=false;
		var poseAtTime=calculatepathPoseAtTime(totPath[pathNumber], totOrient[pathNumber], totPath[pathNumber+1], totOrient[pathNumber+1], t);
	}
	else{
		console.log("K")
		kin=false;
		var poseAtTime= [initialPosition,initialOrientation];
	}
	var positionAtTime= poseAtTime[0];
	var orientationAtTime= poseAtTime[1];
	//console.log("current position="+positionAtTime)
	//console.log("current orientation="+orientationAtTime)

	var ang= inverseKinematics(positionAtTime, orientationAtTime);
	//console.log("inv kin="+ang)
	var b=ang[0];
	var t1= ang[1];
	var t2= ang[2];
	var t3= ang[3];

	//console.log(Math.sin(b)*Math.sin(t1+t2+t3))
	//console.log(Math.cos(t1+t2+t3))
	//console.log(Math.cos(b)*Math.sin(t1+t2+t3))

	//stampo quello che dovrebbe essere la posizione desiderata
	var inpos = new THREE.Geometry();
	var ip= new THREE.Vector3( initialPosition[0],initialPosition[1],initialPosition[2] );
	inpos.vertices.push(ip);
	//dotendEffector0.rotateY(baseArm.rotation.y);
	var dotMaterial = new THREE.PointsMaterial( { size: 12, sizeAttenuation: false, color:"#FF0000" } );
	var dot = new THREE.Points( inpos, dotMaterial);
	//scene.add( dot );

	//stampo punto ottenuto
	var d2 = new THREE.Geometry();
	d2.vertices.push(new THREE.Vector3( Math.sin(b)*(Math.sin(t1) + Math.sin(t1+t2)+ Math.sin(t1+t2+t3)),
													 1 + Math.cos(t1)+ Math.cos(t1+t2)+ Math.cos(t1+t2+t3),
													  Math.cos(b)*(Math.sin(t1) + Math.sin(t1+t2)+ Math.sin(t1+t2+t3))));
	//dotendEffector2.rotateY(baseArm.rotation.y);
	var dotMaterial2 = new THREE.PointsMaterial( { size: 10, sizeAttenuation: false, color:"#00FF00" } );
	var dot2 = new THREE.Points( d2, dotMaterial2);
	//scene.add( dot2 );

	baseArm.rotation.y=ang[0];
	for ( var i = 0; i < arms.length; i ++ ) {
		var arm = arms[i];
		arm.rotation.x=ang[i+1];
	}
	//kin=false;

	//arms[0].rotation.y=1;
}

// GUI

function updateDatGui() {
	gui.close();
	armGuiFolders.forEach(function(folder) {
		gui.removeFolder(folder);
	});

	armGuiFolders = [];
	// first add the folder for the baseArm
	var folder = gui.addFolder("Base");
	console.log(9);
	folder.add(baseArm.rotation, 'y', -Math.PI, +Math.PI).name('rotation_Y');
	armGuiFolders.push(folder);

	for ( var i = 0; i < arms.length; i ++ ) {
		var arm = arms[i];
		folder = gui.addFolder('Arm ' + i);
		console.log(9);
		folder.add(arm.rotation, 'x', -Math.PI/2, +Math.PI/2).name('rotation_X').onChange(function() {
			//console.log(32);
		});
		folder.add(arm.rotation, 'y', -Math.PI, +Math.PI).name('rotation_Y').onChange(function() {
			//console.log(32);
		});
		folder.add(arm, 'armLen', 0.5, 4).onChange(function(value) {
			updateArmLengths();
		});
		armGuiFolders.push(folder);
	}
	gui.open();
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
	//console.log(dTime);
	spheres.forEach(function (s) {
		s.visible = params.coverage;
		//s.position.x = Math.sin(dTime / 300);
	});
	if (particles) {
		particles.visible = params.coverage;
	}
	if(done){
		numIteration=0;
	}
	if(kin){
		uptadeMovement(numIteration);
		numIteration+=1;
	}
	updateScene();

	//CERCO DI RICOSTRUIRE LA POSIZIONE DEGLI END EFFECTOR TRAMITE GLI ANGOLI
	var angles=[]
	arms.forEach(function(arm) {
		angles.push(arm.rotation.x);
		//console.log(arm.rotation.x);
	});
	//console.log(angles);

	var dotendEffector0 = new THREE.Geometry();
	var dotendEffector0position= new THREE.Vector3( Math.sin(baseArm.rotation.y)*Math.sin(angles[0]),
													 1 + Math.cos(angles[0]), 
													 Math.cos(baseArm.rotation.y)*Math.sin(angles[0]) );
	dotendEffector0.vertices.push(dotendEffector0position);
	//dotendEffector0.rotateY(baseArm.rotation.y);
	var dotMaterial = new THREE.PointsMaterial( { size: 3, sizeAttenuation: false } );
	var dot0 = new THREE.Points( dotendEffector0, dotMaterial);
	//scene.add( dot0 );

	var dotendEffector1 = new THREE.Geometry();
	var sumAng0Ang1= angles[0]+angles[1];
	dotendEffector1.vertices.push(new THREE.Vector3( Math.sin(baseArm.rotation.y)*(Math.sin(angles[0]) + Math.sin(sumAng0Ang1)),
													 1 + Math.cos(angles[0])+ Math.cos(sumAng0Ang1),
													  Math.cos(baseArm.rotation.y)*(Math.sin(angles[0]) + Math.sin(sumAng0Ang1)) ));
	//dotendEffector1.rotateY(baseArm.rotation.y);
	var dot1 = new THREE.Points( dotendEffector1, dotMaterial);
	//scene.add( dot1 );

	var dotendEffector2 = new THREE.Geometry();
	var sumAng0Ang1Ang2= angles[0]+angles[1]+angles[2];
	dotendEffector2.vertices.push(new THREE.Vector3( Math.sin(baseArm.rotation.y)*(Math.sin(angles[0]) + Math.sin(sumAng0Ang1)+ Math.sin(sumAng0Ang1Ang2)),
													 1 + Math.cos(angles[0])+ Math.cos(sumAng0Ang1)+ Math.cos(sumAng0Ang1Ang2),
													  Math.cos(baseArm.rotation.y)*(Math.sin(angles[0]) + Math.sin(sumAng0Ang1)+ Math.sin(sumAng0Ang1Ang2))));
	//dotendEffector2.rotateY(baseArm.rotation.y);
	var dot2 = new THREE.Points( dotendEffector2, dotMaterial);
	scene.add( dot2 );


	renderer.render( scene, camera );
	stats.update();
}
