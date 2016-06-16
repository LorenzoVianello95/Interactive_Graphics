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
var coverageDirty = true;

var params = {
	coverage: false,
	coveragePrecision: 2,
	armCount: 3
};

var currentParams = {
	armCount: 0
};

var RobotArm = function(armLen, createMesh = true) {
	THREE.Object3D.apply(this, arguments);
	if (createMesh) {
		var armGeometry = new THREE.CubeGeometry(0.2, 1, 0.2);
		this.armMesh = new THREE.Mesh(armGeometry, this.armMaterial);
		this.armMesh.scale.y = armLen;
		this.armMesh.position.y = armLen / 2;
		this.add(this.armMesh);
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
	gui.add(params, 'coveragePrecision', 1, 16).step(1).name('precision').onFinishChange(onCoveragePrecision);
	gui.add(params, 'armCount', 1, 4).step(1);

	updateScene();

	onWindowResize();

	animate();
}

function createArms(armCount) {
	var baseRotation = 0;
	var armParams = [];
	if (null != baseArm) {
		arms.forEach(function(arm) {
			armParams.push({
				armLen: arm.armLen,
				rotation: arm.rotation.x
			});
			delete arm;
		});
		baseRotation = baseArm.rotation.y;
		delete baseArm;
	}
	arms = [];
	baseArm = new RobotArm(0.2);
	baseArm.rotation.y = baseRotation;
	var prevArm = baseArm;
	for (var i = 0; i < armCount; ++i) {
		arms[i] = new RobotArm(1);
		prevArm.addArm(arms[i]);
		prevArm = arms[i];
	}
	var minSize = Math.min(armParams.length, armCount);
	for (var i = 0; i < minSize; ++i) {
		arms[i].armLen = armParams[i].armLen;
		arms[i].rotation.x = armParams[i].rotation;
	}
	updateArmLengths();
}

function updateArmLengths() {
	arms.forEach(function(arm) {
		arm.updateArmLength();
	});
	coverageDirty = true;
}

function updateArmConstraints() {
	if (baseArm) {
		baseArm.updateConstraints(true);
		var controller = armGuiFolders[0].__controllers[0];
		controller.min(baseArm.constraint.min);
		controller.max(baseArm.constraint.max);
		controller.updateDisplay();
	}
	arms.forEach(function(arm) {
		arm.updateConstraints(false);
	});
	for (var i = 1; i < armGuiFolders.length; ++i) {
		var controller = armGuiFolders[i].__controllers[0];
		controller.min(arms[i-1].constraint.min);
		controller.max(arms[i-1].constraint.max);
		controller.updateDisplay();
	}
	coverageDirty = true;
}

function onCoveragePrecision() {
	coverageDirty = true;
}

function createCoverage() {
	spheres.forEach(function(sphere) {
		delete sphere;
	});
	spheres = [];
	var sphereMat = new THREE.MeshLambertMaterial({color: 0xff0000, transparent: true, opacity: 0.5});
	var sphMesh = new THREE.Mesh( new THREE.SphereGeometry(0.25, 8, 8), sphereMat);
	var baseArmClone = baseArm.cloneArm();
	var lastArm = baseArmClone.getLastChild();
	// make an array with all arms to actaully go through all
	var armArray = [];
	var desc = baseArmClone.childArm;
	while(desc) {
		armArray.push({
			arm: desc,
			dRot: (desc.constraint.max - desc.constraint.min) / params.coveragePrecision
		});
		desc = desc.childArm;
	}
	// add a dummy arm so we can use it's position
	lastArm.addArm(new RobotArm(1, false));
	var endArm = lastArm.childArm;
	baseArmClone.updateMatrixWorld();
	// set all arm positions to minimum
	var resetDescending = function(arm) {
		arm.traverse(function(a) {
			a.rotation.x = a.constraint.min;
		});
	};
	resetDescending(baseArmClone.childArm);
	baseArmClone.updateMatrixWorld();
	const armCount = armArray.length;
	armStack = [];
	for (var i = 0; i < armCount; ++i) {
		armStack.push({
			index: i,
			iteration: 0
		});
	}
	var coveragePositions = [];
	const lastArmDRot = armArray[armCount - 1].dRot;
	const lastArmMin = armArray[armCount - 1].arm.constraint.min;
	while(armStack.length > 0) {
		var armTop = armStack.pop();
		var armRef = armArray[armTop.index].arm;
		// if this is the last arm, iterate it and take all positions
		if (armTop.index == armCount - 1) {
			for (var i = 0; i < params.coveragePrecision + 1; ++i) {
				armRef.rotation.x = lastArmMin + lastArmDRot * i;
				// the parenting matrices should be updated, so update just this one
				armRef.updateMatrixWorld();
				var endPoint = new THREE.Vector3();
				endPoint.setFromMatrixPosition(endArm.matrixWorld);
				coveragePositions.push(endPoint);
			}
		} else if (armTop.iteration < params.coveragePrecision) {
			armTop.iteration++;
			armRef.rotation.x = armRef.constraint.min + armArray[armTop.index].dRot * armTop.iteration;
			// reset descending arms
			resetDescending(armRef.childArm);
			// update matrices
			armRef.updateMatrixWorld();
			// now push again elements on the stack along with this arm
			armStack.push(armTop);
			for (var i = armTop.index + 1; i < armCount; ++i) {
				armStack.push({
					index: i,
					iteration: 0
				});
			}
		} // else just continue with the next object on the stack
	}

	for (var i = 0; i < coveragePositions.length; ++i) {
		var sp = sphMesh.clone();
		//var sp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), sphereMat);
		const pos = coveragePositions[i];
		sp.position.setX(pos.x);
		sp.position.setY(pos.y);
		sp.position.setZ(pos.z);
		spheres.push(sp);
	}
}

function updateScene() {
	var armsUpdated = false;
	if (currentParams.armCount != params.armCount) {
		if (null != baseArm) {
			scene.remove(baseArm);
		}
		createArms(params.armCount);
		scene.add(baseArm); // created by createArms(..)
		currentParams.armCount = params.armCount;
		armsUpdated = true;
	}
	if (armsUpdated) {
		updateDatGui();
	}
	if (coverageDirty) {
		spheres.forEach(function(sphere) {
			scene.remove(sphere);
		});
		createCoverage();
		spheres.forEach(function(sphere) {
			scene.add(sphere);
		});
		coverageDirty = false;
	}
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
	folder.add(baseArm.rotation, 'y', baseArm.constraint.min, baseArm.constraint.max).name('rotation');
	folder.add(baseArm.constraint, 'min', -Math.PI, 0).onChange(function() {
		updateArmConstraints();
	});
	folder.add(baseArm.constraint, 'max', 0, Math.PI).onChange(function() {
		updateArmConstraints();
	});
	armGuiFolders.push(folder);

	for ( var i = 0; i < arms.length; i ++ ) {
		var arm = arms[i];
		folder = gui.addFolder('Arm ' + i);
		folder.add(arm.rotation, 'x', arm.constraint.min, arm.constraint.max).name('rotation');
		folder.add(arm.constraint, 'min', -Math.PI, 0).onChange(function() {
			updateArmConstraints();
		});
		folder.add(arm.constraint, 'max', 0, Math.PI).onChange(function() {
			updateArmConstraints();
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
	spheres.forEach(function (s) {
		s.visible = params.coverage;
		//s.position.x = Math.sin(dTime / 300);
	});
	updateScene();
	renderer.render( scene, camera );
	stats.update();
}
