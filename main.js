import './style.css'
import * as THREE from 'three'
import $ from 'jquery';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { MathUtils } from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';




let scene = null;
let camera = null;
let renderer = null;
let canvas = null;
let raycaster = null;
let pointer = null;

let aspect = null;
let center = null;
let directionalLight = null;
let trackballControls = null;
let transformControls = null;
let material = null;
let poinstData = new Map();

let objectSize = null
let distalMedialToResectionPlaneDistance = 10

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

let clippingPlanesArray = []
let currentPoint = {
  "name": undefined,
  "activePlotting": false,
  'color': undefined
}

function main() {
  canvas = document.querySelector('canvas.webgl')

  //register event listeners 
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerdown', onPointerClick)
  init();
  draw();
}

function init() {

  //scene 
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x808080);

  aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(
    -aspect * 1, aspect * 1, 1, -1, 0.01, 2000
  );

  //renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas })
  renderer.localClippingEnabled = false;
  renderer.setSize(sizes.width, sizes.height)

  //initialize trackball controls 
  trackballControls = new TrackballControls(camera, renderer.domElement);
  trackballControls.rotateSpeed = 2.0;

  //initialize the transform controls 
  transformControls = new TransformControls(camera, renderer.domElement)

  //initialize raycaster 
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  //light 
  directionalLight = new THREE.DirectionalLight(0xffffff, Math.PI)
  directionalLight.position.set(1, 1, 1)
  scene.add(directionalLight)

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, Math.PI)
  directionalLight2.position.set(-1, -1, -1)
  scene.add(directionalLight2)

  let femurSTL = '/models/Right_Femur.stl';
  let tibiaSTL = '/models/Right_Tibia.stl'
  loadTibiaSTL(tibiaSTL, true, 'tibia');
  loadSTL(femurSTL, true, 'femur');

}
function resize() {
  aspect = window.innerWidth / window.innerHeight;
  camera.left = -aspect * 1;
  camera.right = aspect * 1;
  camera.top = 1;
  camera.bottom = -1;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function loadSTL(url, visible, name) {
  let stlloader = new STLLoader()
  stlloader.load(url, function (geometry) {
    material = new THREE.MeshPhongMaterial({ color: 0xffdbac, transparent: true, clippingPlanes: clippingPlanesArray })
    let mesh = new THREE.Mesh(geometry, material)

    mesh.name = name
    mesh.visible = visible
    setObject(mesh)
  })
}

function loadTibiaSTL(url, visible, name) {
  let stlloader = new STLLoader()
  stlloader.load(url, function (geometry) {
    material = new THREE.MeshPhongMaterial({ color: 0xffdbac, transparent: true, clippingPlanes: clippingPlanesArray })
    let mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.visible = visible
    scene.add(mesh)
  })
}

function setObject(object) {
  const box = new THREE.Box3().setFromObject(object)
  const VectorSize = new THREE.Vector3()
  const size = box.getSize(VectorSize)

  const VectorCenter = new THREE.Vector3()
  center = box.getCenter(VectorCenter)



  camera.lookAt(center)


  trackballControls.target = center

  objectSize = Math.max(size.x, size.y, size.z)
  const distance = aspect / objectSize
  camera.zoom = distance
  camera.updateProjectionMatrix()

  scene.add(object)
  return object
}






//set view according relative to point so it is easy to mark the points
function setView(cameraDirection, upVector) {
  let cameraPos = center.clone().add(cameraDirection.multiplyScalar(400))
  camera.position.copy(cameraPos)
  camera.lookAt(center)
  camera.up = upVector
  const distance = aspect / objectSize
  camera.zoom = distance
  camera.updateProjectionMatrix()

}



//#region helper functions
function removeObject(objectName) {
  let object = scene.getObjectByName(objectName)
  scene.remove(object)
}

function createPlane(color = 0xffff00, visible = false) {
  const geometry = new THREE.PlaneGeometry(100, 100);
  const material = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
  const plane = new THREE.Mesh(geometry, material);
  plane.visible = visible
  return plane
}

function getPlaneNormal(plane) {
  let geom_pos = plane.geometry.attributes.position.array
  let v1 = new THREE.Vector3(
    geom_pos[0],
    geom_pos[1],
    geom_pos[2]
  )

  let v2 = new THREE.Vector3(
    geom_pos[3],
    geom_pos[4],
    geom_pos[5]
  )

  let v3 = new THREE.Vector3(
    geom_pos[6],
    geom_pos[7],
    geom_pos[8]
  )
  plane.localToWorld(v1)
  plane.localToWorld(v2)
  plane.localToWorld(v3)
  let vec = v1.sub(v2);
  let vecTwo = v2.sub(v3);
  let normal = vec.cross(vecTwo).normalize()
  return normal
}

function createLines(pointOneKey, pointTwoKey, lineName, visible = false) {
  if (poinstData.has(lineName)) {
    removeObject(lineName)
    poinstData.delete(lineName)
  }
  let point1 = poinstData.get(pointOneKey)
  let point2 = poinstData.get(pointTwoKey)

  const points = []
  points.push(point1.position.clone())
  points.push(point2.position.clone())
  let geometry = new THREE.BufferGeometry().setFromPoints(points)
  let line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x0000ff }))
  line.visible = visible
  poinstData.set(lineName, line)
  line.name = lineName
  scene.add(line)

}

function attachTransformControl(object) {
  //if object attach removed that   
  transformControls.attach(object)
  scene.add(transformControls)

  transformControls.addEventListener('mouseDown', () => {
    trackballControls.enabled = false;
  });

  transformControls.addEventListener('mouseUp', () => {
    trackballControls.enabled = true;
  });

}


function createAndPlacePoint(position, inPointName, inColor, attachtc = false) {
  if (poinstData.has(inPointName)) {
    removeObject(inPointName)
    poinstData.delete(inPointName)
  }
  const geometry = new THREE.SphereGeometry(2);
  const material = new THREE.MeshBasicMaterial({ color: inColor });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.name = inPointName;
  sphere.position.copy(position)
  scene.add(sphere);
  poinstData.set(inPointName, sphere);

  //attach transform controls to the point 
  if (attachtc) {
    attachTransformControl(sphere)
    currentPoint.name = undefined
    currentPoint.activePlotting = false

  }
}

function detachAndRemoveControls() {
  if (transformControls.object) {
    transformControls.detach()
    scene.remove(transformControls)
  }
}

function createDuplicateObject(inObject, inName, inColor = '#ff0000') {
  let object = new THREE.Mesh(inObject.geometry.clone(), inObject.material.clone())
  object.rotation.copy(inObject.rotation)
  object.material.color.set(inColor)
  object.position.copy(inObject.position)
  object.name = inName
  return object
}

function getNormal(point1, point2) {
  return point1.sub(point2).normalize()
}

function setResection(resectionVisibility) {
  renderer.localClippingEnabled = resectionVisibility
}
function setTibiaVisibility(tibiaVisibility) {
  let obj = scene.getObjectByName('tibia')
  scene.remove(obj)
}
//#endregion

//#region plane creation
function createPerpendicularToMeachanicalAxisPlane(inPosition) {

  if (poinstData.has('PerpendicularToMeachanicalAxisPlane')) {
    removeObject('PerpendicularToMeachanicalAxisPlane')
    poinstData.delete('PerpendicularToMeachanicalAxisPlane')
  }

  let plane = createPlane(0xff0000, false)
  plane.position.copy(inPosition)
  plane.name = 'PerpendicularToMeachanicalAxisPlane'
  poinstData.set('PerpendicularToMeachanicalAxisPlane', plane)
  scene.add(plane)
  let normal1 = getPlaneNormal(plane);

  //get normal two
  let objOne = poinstData.get('femur-center')
  let point1Pos = objOne.position.clone()
  let objTwo = poinstData.get('hip-center')
  let point2Pos = objTwo.position.clone()

  point1Pos.sub(point2Pos)
  let normal2 = point1Pos.normalize()
  console.log('mechanical-axis', normal2);

  //get angle between normal1 and normal2
  let angle = normal1.angleTo(normal2)

  let rotationAxis = normal1.clone().cross(normal2)

  rotationAxis.normalize()

  plane.rotateOnWorldAxis(rotationAxis, angle)
  return plane

}
function createPerpendicularToMeachanicalAxisPlaneDup() {

  if (poinstData.has('varus-valgus-plane')) {
    removeObject('varus-valgus-plane')
    poinstData.delete('varus-valgus-plane')
  }
  let plane = poinstData.get('PerpendicularToMeachanicalAxisPlane')
  let dupPlane = createDuplicateObject(plane, 'varus-valgus-plane', '#ffff00')
  dupPlane.visible = false
  poinstData.set(dupPlane.name, dupPlane)
  scene.add(dupPlane)
}
function createVarusValgusPlaneDup() {
  if (poinstData.has('flexion-extension-plane')) {
    removeObject('flexion-extension-plane')
    poinstData.delete('flexion-extension-plane')
  }
  let plane = poinstData.get('varus-valgus-plane')
  let dupPlane = createDuplicateObject(plane, 'flexion-extension-plane', '#00ff00')
  dupPlane.visible = false
  poinstData.set(dupPlane.name, dupPlane)
  scene.add(dupPlane)

}
function createDistalMedialPlane() {
  if (poinstData.has('distalMedialPlane')) {
    removeObject('distalMedialPlane')
    poinstData.delete('distalMedialPlane')
  }

  let distalMedialPoint = poinstData.get('distal-medial-point')
  let inPosition = distalMedialPoint.position.clone()

  let plane = createPlane('#0000ff', false)
  plane.position.copy(inPosition)
  plane.name = 'distalMedialPlane'
  poinstData.set('distalMedialPlane', plane)

  //make this plane paralle to flexion-extension-plane

  let flexionExtensionPlane = poinstData.get('flexion-extension-plane')
  let flexionExtensionPlaneNormal = getPlaneNormal(flexionExtensionPlane)

  let distalMedialPlaneNormal = getPlaneNormal(plane)

  //get angle between this two plane normal

  let angle = distalMedialPlaneNormal.angleTo(flexionExtensionPlaneNormal)

  //now calculate the rotation axis which will use to rotate the plane  
  let rotationAxis = distalMedialPlaneNormal.clone().cross(flexionExtensionPlaneNormal)
  rotationAxis.normalize()

  //now rotate distalMedialPlane
  plane.rotateOnWorldAxis(rotationAxis, angle)

  scene.add(plane)

}

function createDistalResectionPlane(distance) {
  if (poinstData.has('distalResectionPlane')) {
    removeObject('distalResectionPlane')
    poinstData.delete('distalResectionPlane')
  }

  let plane = createPlane('#00ffff', false)
  plane.name = 'distalResectionPlane'
  poinstData.set('distalResectionPlane', plane)

  //set distance to 10 mm from distalMedialPlane
  //get distalMedialPlane normal and that to distal-medial-point
  let distalMedialPointObj = poinstData.get('distal-medial-point')
  let distalMedialPointPos = distalMedialPointObj.position.clone()

  let distalMedialPlane = poinstData.get('distalMedialPlane')
  let distalMedialPlaneNormal = getPlaneNormal(distalMedialPlane);
  let distalResectionPlanePos = distalMedialPointPos.add(distalMedialPlaneNormal.negate().multiplyScalar(distance))
  plane.position.copy(distalResectionPlanePos)

  let flexionExtensionPlane = poinstData.get('flexion-extension-plane')
  plane.rotation.copy(flexionExtensionPlane.rotation)

  let distalMathPlane = new THREE.Plane()
  let distalResectionPlaneNormal = getPlaneNormal(plane);


  distalMathPlane.setFromNormalAndCoplanarPoint(distalResectionPlaneNormal.negate(), plane.position.clone())
  clippingPlanesArray.pop()
  clippingPlanesArray.push(distalMathPlane)
  scene.add(plane)
}
//#endregion

//#region projection functions
function projectTEAAxisOnMechanicalAxisPlane(normal, position) {
  let plane = new THREE.Plane()
  plane.setFromNormalAndCoplanarPoint(normal, position)
  //project TEA Axis On this plane

  let objOne = poinstData.get('medial-epicondyle')
  let point1Pos = objOne.position.clone()
  let objTwo = poinstData.get('lateral-epicondyle')
  let point2Pos = objTwo.position.clone()
  let projectPointOne = new THREE.Vector3()
  let projectPointTwo = new THREE.Vector3()

  plane.projectPoint(point1Pos, projectPointOne)
  plane.projectPoint(point2Pos, projectPointTwo)

  createAndPlacePoint(projectPointOne, 'projectPointOne', '#ff00ff')
  createAndPlacePoint(projectPointTwo, 'projectPointTwo', '#ff00ff')
  createLines('projectPointOne', 'projectPointTwo', 'projectedTEA')
}
function projectAnteriorLineOneVarusValgusPlane() {

  let anteriorLinePointOne = poinstData.get('anteriorPoint')
  let anteriorLinePointTwo = poinstData.get('femur-center')
  let anteriorLinePointOnePos = anteriorLinePointOne.position.clone()
  let anteriorLinePointTwoPos = anteriorLinePointTwo.position.clone()
  let normal = anteriorLinePointOnePos.sub(anteriorLinePointTwoPos).normalize()

  let mechanicalAxisPoint = poinstData.get('hip-center')
  let mechanicalAxisPointPos = mechanicalAxisPoint.position.clone()
  let normalMechanicalAxis = mechanicalAxisPointPos.sub(anteriorLinePointTwoPos).normalize()

  let crossVector = normal.cross(normalMechanicalAxis).normalize()
  anteriorLinePointTwoPos.add(crossVector.multiplyScalar(10))
  createAndPlacePoint(anteriorLinePointTwoPos, 'lateralLinePoint', '#0000ff')

  let plane = new THREE.Plane()
  let vvPlane = poinstData.get('varus-valgus-plane')
  let planeNormal = getPlaneNormal(vvPlane)
  plane.setFromNormalAndCoplanarPoint(planeNormal, vvPlane.position)
  let projectedPoint = new THREE.Vector3()
  plane.projectPoint(anteriorLinePointTwoPos, projectedPoint)
  createAndPlacePoint(projectedPoint, 'lateralProjectedPoint', '#ff00ff')
  createLines('femur-center', 'lateralProjectedPoint', 'lateralLine')

}
function createAnteriorLine() {
  //find rotation axis
  let objOne = poinstData.get('femur-center')
  let point1Pos = objOne.position.clone()
  let objTwo = poinstData.get('hip-center')
  let point2Pos = objTwo.position.clone()
  point1Pos.sub(point2Pos)
  let normal2 = point1Pos.normalize()

  //find vector perpendicular to projected TEA
  let projectPointOne = poinstData.get('projectPointOne')
  let projectPointOnePos = projectPointOne.position.clone()
  let projectPointTwo = poinstData.get('projectPointTwo')
  let projectPointTwoPos = projectPointTwo.position.clone()
  projectPointOnePos.sub(projectPointTwoPos)
  projectPointOnePos.normalize()


  let vec = projectPointOnePos.applyAxisAngle(normal2, MathUtils.degToRad(90))
  console.log('after', projectPointOnePos);

  //create anterior line 
  let femurCenterPos = objOne.position.clone()
  let anteriorPointPos = femurCenterPos.clone().add(projectPointOnePos.multiplyScalar(10))
  createAndPlacePoint(anteriorPointPos.clone(), 'anteriorPoint', '#A09383')
  createLines('femur-center', 'anteriorPoint', 'anterior-line')
}
//#endregion

//#region handlers 
function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera)

  const intersects = raycaster.intersectObjects(scene.children);
  if (intersects.length > 0 && currentPoint.activePlotting) {
    if (intersects[0].object.name == 'femur') {
      $('html,body').css('cursor', 'crosshair');
    }
  } else {
    $('html,body').css('cursor', 'default');
  }
}

function onPointerClick(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera)

  const intersects = raycaster.intersectObjects(scene.children);
  if (intersects.length > 0 && currentPoint.activePlotting) {
    if (intersects[0].object.name == 'femur') {
      createAndPlacePoint(intersects[0].point, currentPoint.name, currentPoint.color, true)

    }
  }

}
//#endregion

//#region show distanc
function showMesurement() {

  const distalMedialPoint = poinstData.get('distal-medial-point')
  let distalMedialPointPos = distalMedialPoint.position.clone()

  const distalLateralPoint = poinstData.get('distal-lateral-point')
  let distalLateralPointPos = distalLateralPoint.position.clone()


  const distalResectionPlane = poinstData.get('distalResectionPlane')
  const distalResectionPlanePos = distalResectionPlane.position.clone();
  const distance = distalResectionPlanePos.distanceTo(distalMedialPointPos)

  console.log('Distance between distalMedialPoint and distalResectionPlane:', Math.abs(distance.toFixed(2)));
  let distanceToProjectedTextMedial = Math.abs(distance.toFixed(2)).toString() + " mm"


  createLines('distal-medial-point', 'distalResectionPlane', 'mesurement-line-distal-to-resection', true)

  //project Point so we can create line to that point
  let plane = new THREE.Plane()

  let planeNormalNew = getPlaneNormal(distalResectionPlane)
  plane.setFromNormalAndCoplanarPoint(planeNormalNew, distalResectionPlanePos)
  let projectedPoint = new THREE.Vector3()
  plane.projectPoint(distalLateralPointPos, projectedPoint)
  createAndPlacePoint(projectedPoint, 'mesurementProjectedPointLateral', "#ff00ff")
  const distanceToProjected = distalLateralPointPos.distanceTo(projectedPoint)
  console.log('Distance between distalLateralPoint and mesurementProjectedPointLateral:', Math.abs(distanceToProjected.toFixed(2)));
  let distanceToProjectedTextLateral = Math.abs(distanceToProjected.toFixed(2)).toString() + " mm"

  createLines('distal-lateral-point', 'mesurementProjectedPointLateral', 'mesurement-line-lateral-to-resection', true)

  const loader = new FontLoader()

  loader.load('fonts/helvetiker_regular.typeface.json', function (f) {
    let textGeometryMedial = new TextGeometry(distanceToProjectedTextMedial, {
      font: f,
      size: 5,
      depth: 1
    });

    const midpoint = new THREE.Vector3();
    midpoint.addVectors(distalResectionPlanePos, distalMedialPointPos).multiplyScalar(0.5);

    const material = new THREE.MeshBasicMaterial({ color: 'red' });
    const mesh = new THREE.Mesh(textGeometryMedial, material);
    mesh.position.copy(midpoint)
    mesh.rotateX(MathUtils.degToRad(90))
    mesh.name = 'ditanceMedialToResectionText'
    if (poinstData.has('ditanceMedialToResectionText')) {
      removeObject('ditanceMedialToResectionText')
      poinstData.delete('ditanceMedialToResectionText')
    }
    poinstData.set('ditanceMedialToResectionText', mesh)
    scene.add(mesh);

    let textGeometryLateral = new TextGeometry(distanceToProjectedTextLateral, {
      font: f,
      size: 5,
      depth: 1
    });

    const midpointNew = new THREE.Vector3();
    midpointNew.addVectors(projectedPoint, distalLateralPointPos).multiplyScalar(0.5);
    const meshLateral = new THREE.Mesh(textGeometryLateral, material);
    meshLateral.position.copy(midpointNew)
    meshLateral.rotateX(MathUtils.degToRad(90))
    meshLateral.name = 'ditanceLateralToResectionText'
    if (poinstData.has('ditanceLateralToResectionText')) {
      removeObject('ditanceLateralToResectionText')
      poinstData.delete('ditanceLateralToResectionText')
    }
    poinstData.set('ditanceLateralToResectionText')

    scene.add(meshLateral);



  })





}
//#endregion
//#region plane rotation
function rotateVVPlane(offSetAngle) {
  let vvPlane = poinstData.get('varus-valgus-plane')
  let anteriorLinePointOne = poinstData.get('anteriorPoint')
  let anteriorLinePointTwo = poinstData.get('femur-center')
  let anteriorLinePointOnePos = anteriorLinePointOne.position.clone()
  let anteriorLinePointTwoPos = anteriorLinePointTwo.position.clone()
  let normal = anteriorLinePointOnePos.sub(anteriorLinePointTwoPos).normalize()
  vvPlane.rotateOnWorldAxis(normal, MathUtils.degToRad(offSetAngle))
  createVarusValgusPlaneDup()
  createDistalMedialPlane()
  createDistalResectionPlane(distalMedialToResectionPlaneDistance)
  showMesurement()
}

function rotateFEPlane(offSetAngle) {
  let fePlane = poinstData.get('flexion-extension-plane')
  let lateralLinePointOne = poinstData.get('lateralProjectedPoint')
  let lateralLinePointTwo = poinstData.get('femur-center')
  let lateralLinePointOnePos = lateralLinePointOne.position.clone()
  let lateralLinePointTwoPos = lateralLinePointTwo.position.clone()
  let normal = lateralLinePointOnePos.sub(lateralLinePointTwoPos).normalize()
  fePlane.rotateOnWorldAxis(normal, MathUtils.degToRad(offSetAngle))
  createDistalMedialPlane()
  createDistalResectionPlane(distalMedialToResectionPlaneDistance)
  showMesurement()
}
//#endregion
function draw() {
  requestAnimationFrame(draw)
  renderer.render(scene, camera)
  trackballControls.update()
}
main()

$(document).ready(function () {


  $('#femur-pt').on('click', function () {
    handleFemurPtClick();
  });

  $('#hip-pt').on('click', function () {
    handleHipPtClick();
  });

  $('#femur-poximal-canal-pt').on('click', function () {
    handleFemurProximalCanalClick();
  });

  $('#femur-distal-canal-pt').on('click', function () {
    handleFemurDistalCanalClick();
  });

  $('#medial-epicondyle-pt').on('click', function () {
    handleMedialEpicondyleClick();
  });

  $('#lateral-epicondyle-pt').on('click', function () {
    handleLateralEpicondyleClick();
  });

  $('#distal-medial-pt').on('click', function () {
    handleDistalMedialPtClick();
  });

  $('#distal-lateral-pt').on('click', function () {
    handleDistalLateralPtClick();
  });

  $('#posterior-medial-pt').on('click', function () {
    handlePosteriorMedialPtClick();
  });

  $('#posterior-lateral-pt').on('click', function () {
    handlePosteriorLateralPtClick();
  });


  $('#update-btn').on('click', function () {
    handleUpdateClick();
  });


  $('.decrement').eq(0).on('click', function () {
    decrementVarusValgus();
  });

  $('.increment').eq(0).on('click', function () {
    incrementVarusValgus();
  });


  $('.decrement').eq(1).on('click', function () {
    decrementFlexionExtension();
  });

  $('.increment').eq(1).on('click', function () {
    incrementFlexionExtension();
  });

  $('.decrement').eq(2).on('click', function () {
    decrementDistalResection();
  });

  $('.increment').eq(2).on('click', function () {
    incrementDistalResection();
  });

  $('#resection-switch').on('change', function () {
    toggleResection();
  });

  $('#tibia-switch').on('change', function () {
    toggleTibiaVisbility();
  });



  function handleFemurPtClick() {
    console.log('Femur Center selected');
    currentPoint.name = 'femur-center'
    currentPoint.activePlotting = true
    currentPoint.color = '#ff0000'
    setView(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0))
  }

  function handleHipPtClick() {
    detachAndRemoveControls()
    currentPoint.name = 'hip-center'
    currentPoint.activePlotting = true
    currentPoint.color = '#ff0000'
    setView(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1))

  }

  function handleFemurProximalCanalClick() {
    console.log('Femur Proximal Canal selected');
    detachAndRemoveControls()
    currentPoint.name = 'femur-proximal-canal'
    currentPoint.activePlotting = true
    currentPoint.color = '#00ff00'
    setView(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1))
  }

  function handleFemurDistalCanalClick() {
    console.log('Femur Distal Canal selected');
    detachAndRemoveControls()
    currentPoint.name = 'femur-distal-canal'
    currentPoint.activePlotting = true
    currentPoint.color = '#00ff00'
    setView(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1))

  }

  function handleMedialEpicondyleClick() {
    console.log('Medial Epicondyle selected');
    detachAndRemoveControls()
    currentPoint.name = 'medial-epicondyle'
    currentPoint.activePlotting = true
    currentPoint.color = '#180585'
    setView(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1))

  }

  function handleLateralEpicondyleClick() {
    console.log('Lateral Epicondyle selected');
    detachAndRemoveControls()
    currentPoint.name = 'lateral-epicondyle'
    currentPoint.activePlotting = true
    currentPoint.color = '#180585'
    setView(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1))

  }

  function handleDistalMedialPtClick() {
    console.log('Distal Medial Point selected');
    detachAndRemoveControls()
    currentPoint.name = 'distal-medial-point'
    currentPoint.activePlotting = true
    currentPoint.color = '#0acf21'
    setView(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0))



  }
  function handleDistalLateralPtClick() {
    detachAndRemoveControls()
    currentPoint.name = 'distal-lateral-point'
    currentPoint.activePlotting = true
    currentPoint.color = '#0acf21'
    setView(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0))


  }

  function handlePosteriorMedialPtClick() {
    detachAndRemoveControls()
    currentPoint.name = 'posterior-medial-point'
    currentPoint.activePlotting = true
    currentPoint.color = '#180585'
    setView(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1))

  }

  function handlePosteriorLateralPtClick() {
    console.log('Posterior Lateral Point selected');
    detachAndRemoveControls()
    currentPoint.name = 'posterior-lateral-point'
    currentPoint.activePlotting = true
    currentPoint.color = '#180585'
    setView(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1))

  }

  function handleUpdateClick() {
    let femur = scene.getObjectByName('femur')
    femur.material.opacity = 0.7
    detachAndRemoveControls()
    setView(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1))
    //draw lines between points that we have marked
    createLines('femur-center', 'hip-center', 'mechanical-axis', true)
    createLines('femur-proximal-canal', 'femur-distal-canal', 'anatomical-axis', true)
    createLines('medial-epicondyle', 'lateral-epicondyle', 'TEA-trans-epicondyle-axis', true)
    createLines('posterior-medial-point', 'posterior-lateral-point', 'PCA-posterior-condyle-axis', true)

    //create perpendicular plane 
    let objOne = poinstData.get('femur-center')
    createPerpendicularToMeachanicalAxisPlane(objOne.position.clone())

    //project TEA Axis on Perpendicular Plane
    let point1Pos = objOne.position.clone()
    let objTwo = poinstData.get('hip-center')
    let point2Pos = objTwo.position.clone()
    let normal = getNormal(point1Pos, point2Pos)
    let plane = scene.getObjectByName('PerpendicularToMeachanicalAxisPlane')
    projectTEAAxisOnMechanicalAxisPlane(normal, plane.position.clone())
    console.log(poinstData)

    //create Anterior Line
    createAnteriorLine()

    //create Varus-valgus plane 
    createPerpendicularToMeachanicalAxisPlaneDup()

    //project anterior line on varus valgus plane
    projectAnteriorLineOneVarusValgusPlane()

    //create flexion-extension plane
    createVarusValgusPlaneDup()

    createDistalMedialPlane()

    createDistalResectionPlane(distalMedialToResectionPlaneDistance)
    showMesurement()
    console.log(scene.children)
  }

  function decrementVarusValgus() {
    console.log('Varus/Valgus decreased');
    updateVarusValgus(-1);
    rotateVVPlane(-1)

  }

  function incrementVarusValgus() {
    console.log('Varus/Valgus increased');
    updateVarusValgus(1);
    rotateVVPlane(1)

  }

  function decrementFlexionExtension() {
    console.log('Flexion/Extension decreased');
    updateFlexionExtension(-1);
    rotateFEPlane(-1)

  }

  function incrementFlexionExtension() {
    console.log('Flexion/Extension increased');
    updateFlexionExtension(1);
    rotateFEPlane(1)
  }

  function decrementDistalResection() {
    console.log('Distal Resection decreased');
    updateDistalResection(-1);
  }

  function incrementDistalResection() {
    console.log('Distal Resection increased');
    updateDistalResection(1);
  }

  function toggleResection() {
    const isChecked = $('#resection-switch').is(':checked');
    console.log('Resection toggled: ' + (isChecked ? 'On' : 'Off'));
    setResection(isChecked)
  }

  function toggleTibiaVisbility() {
    const isChecked = $('#tibia-switch').is(':checked');
    console.log('Tibia toggled: ' + (isChecked ? 'On' : 'Off'));
    setTibiaVisibility(isChecked)
  }

  function updateVarusValgus(change) {
    let currentValue = parseInt($('#varus-valgus').val(), 10);
    let newValue = currentValue + change;
    $('#varus-valgus').val(newValue + '°');
  }

  function updateFlexionExtension(change) {
    let currentValue = parseInt($('#flexion-extension').val(), 10);
    let newValue = currentValue + change;
    $('#flexion-extension').val(newValue + '°');
  }

  function updateDistalResection(change) {
    let currentValue = parseInt($('#distal-resection').val(), 10);
    let newValue = currentValue + change;
    $('#distal-resection').val(newValue + ' mm');
    distalMedialToResectionPlaneDistance = newValue
    createDistalResectionPlane(newValue)
    showMesurement()
  }

});
