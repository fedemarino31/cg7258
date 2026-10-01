


var $window=$(window);    
var $container = $('#container3D');

var renderer,camGlobal,cam,camLeft,camTop,scene,OrbitControls;   
var w,h;
var cameras;

var viewBoxSize=100;
var planoProyeccion;

var gridHelper,gridHelper2;

var modelFile="ejercicios/1c2021/ep9-perspectivas.json"

function start(){
    w=$container.width();
    h=$container.height();
    
    scene = new THREE.Scene();
    scene2 = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize($container.width(), $container.height());
    renderer.setClearColor(0xEEEEEE);
    renderer.autoClear = false;    
    
    var aspect=w/h;
    var near=0.1;
    var far=1000;
    
    camGlobal=new THREE.PerspectiveCamera(45,aspect,1,1000);
    controls = new THREE.OrbitControls( camGlobal, renderer.domElement );

    camGlobal.position.set(100,100,100);
    camGlobal.lookAt(new THREE.Vector3(0,0,0));

    camTop=new THREE.OrthographicCamera(-viewBoxSize,viewBoxSize,viewBoxSize/aspect,-viewBoxSize/aspect,-1000,1000);
    camTop.position.set(0,100,0);
    camTop.lookAt(new THREE.Vector3(0,0,0));

    camLeft=new THREE.OrthographicCamera(-viewBoxSize,viewBoxSize,viewBoxSize/aspect,-viewBoxSize/aspect,-1000,1000);
    camLeft.position.set(0,0,100);
    camLeft.lookAt(new THREE.Vector3(0,0,0));
    
    
    cam=new THREE.PerspectiveCamera(75,aspect,near,far);
    cam.position.set(-30,0,0);    
    //cam.lookAt(new THREE.Vector3(0,0,0));

    controls.update();
    
    var helper = new THREE.CameraHelper( cam );
    //scene.add( helper );

    cameras=[camGlobal,camTop,cam,camLeft];

    
    
    $container.append(renderer.domElement);
    //$window.resize(onResize);
    //onResize();
   

    var ambienLight=new THREE.AmbientLight(0x111133);
    scene.add(ambienLight);

    var directionalLight = new THREE.DirectionalLight( 0xffffff,1 );
    directionalLight.position.set(1,2,3);
    scene.add( directionalLight );

    gridHelper = new THREE.GridHelper( 200,20,
        new THREE.Color(0x777777),new THREE.Color(0xAAAAAA) 
    );
    
    scene.add( gridHelper );

    gridHelper2=gridHelper.clone();
    gridHelper2.rotation.x=Math.PI/2;
    scene.add( gridHelper2 );

    //var axesHelper = new THREE.AxesHelper( 10 );
    //scene.add( axesHelper );

    var light = new THREE.HemisphereLight( 0xffffbb, 0x080820, 1 );
    scene.add( light );

    var axis=getAxis(10,0.5);
    scene.add(axis);

    $("body").keydown(function (e){
        console.log(e.key);
        if (e.key=="h") $("#descripcion").toggle();

    })
}

function getAxis(l,r){
    

    
   var x= new THREE.Mesh( new THREE.BoxGeometry( l, r, r ).translate(l/2,0,0), new THREE.MeshBasicMaterial( {color: 0xff0000} ));
   var y= new THREE.Mesh( new THREE.BoxGeometry( r, l, r ).translate(0,l/2,0), new THREE.MeshBasicMaterial( {color: 0x00ff00} ));
   var z= new THREE.Mesh( new THREE.BoxGeometry( r, r, l ).translate(0,0,l/2), new THREE.MeshBasicMaterial( {color: 0x0000ff} ));
   var g=new THREE.Group();

   g.add(x);
   g.add(y);
   g.add(z);

   return g;
}


function getPivot(l,r){
    var mat=new THREE.MeshBasicMaterial( {color: 0x000000} )
   
    var x= new THREE.Mesh( new THREE.BoxGeometry( l, r, r ), mat);
    var y= new THREE.Mesh( new THREE.BoxGeometry( r, l, r ), mat);
    var z= new THREE.Mesh( new THREE.BoxGeometry( r, r, l ), mat);
    var g=new THREE.Group();
 
    g.add(x);
    g.add(y);
    g.add(z);
 
    return g;
 }

function buildScene(){
    /*
    var geometry =  new THREE.SphereGeometry( 5, 32, 32 );
    var material = new THREE.MeshPhongMaterial( {color: 0x00FFFF} );
    var sphere = new THREE.Mesh( geometry, material );
    sphere.position.x=20;
    scene.add( sphere );*/
    

    $.ajax(modelFile).done(onJsonLoaded);        
    
}

function prv(v){
    return v.x+","+v.y+","+v.z;
}

function onJsonLoaded(data){

    
    var ej=data;
    console.log(data);

    var html="";
    
    var matNegro = new THREE.MeshBasicMaterial( {color: 0x000000} );
    var meshPunto = new THREE.Mesh( new THREE.SphereGeometry( 1, 32, 32 ), matNegro );
    

    // plano de proyeccion
    var posFoco=new THREE.Vector3(ej.plano.foco[0],ej.plano.foco[1], ej.plano.foco[2]);

    var foco=meshPunto.clone();
    foco.position.copy(posFoco);

    // posicion del plano en coord de mundo
    var posicionPlano=posFoco.clone();        
    var nearVec=new THREE.Vector3(ej.plano.near[0],ej.plano.near[1],ej.plano.near[2]);        
    posicionPlano.add(nearVec);
    
    var geometry = new THREE.BoxGeometry( ej.plano.ancho,ej.plano.alto,1);
    var matPlano = new THREE.MeshBasicMaterial( {
        color: 0x666666, 
        side: THREE.DoubleSide,
        transparent:true,
        opacity:0.25
     });
    planoProyeccion = new THREE.Mesh( geometry, matPlano );

    /*
    var geometry = new THREE.BoxGeometry(0.25,0.25,20).translate(0,0,10);
    normalPlano = new THREE.Mesh( geometry, matNegro );
    planoProyeccion.add(normalPlano);
     */

    planoProyeccion.position.copy(posicionPlano);
    var target=posicionPlano.clone();
    target.add(nearVec);
    planoProyeccion.lookAt(target);

    
    scene.add( planoProyeccion );


    console.log("foco="+prv(foco.position));

    cam.position.copy(foco.position);
    cam.fov=ej.plano.vFov;
    cam.updateProjectionMatrix();

    cam.lookAt(planoProyeccion.position);

    scene.add(foco);

    html1="<h3>Plano de proyección</h3>";
    html1+="<p>foco =("+prv(posFoco)+")<br>";
    html1+=" un punto del plano  = ("+prv(planoProyeccion.position)+")<br>";
    html1+=" vector normal del plano  = ("+prv(nearVec)+")</p>";


    

    // objetos
    htmlObjetos="";
    var pivot=getPivot(5,0.2);
    $.each(ej.objetos,function(k,v){

        var mesh;
        var parametrosForma="";
        var txtColor;
        switch(v.tipo){
            case "cubo":
                var geo=new THREE.BoxBufferGeometry( v.ancho,v.largo, v.alto);
                
                geo.translate(0,v.largo/2,0)
                var mat = new THREE.MeshPhongMaterial({
                    "color":parseInt(v.color),
                    transparent:true,
                    opacity:0.5
                });
                mesh=new THREE.Mesh(geo,mat);
                parametrosForma=" dimensiones XYZ = ("+v.ancho+","+v.largo+","+v.alto+")<br>";                
                break;

            case "esfera":
                var geo=new THREE.SphereBufferGeometry( v.radio,32,32);
                var mat = new THREE.MeshPhongMaterial({
                    "color":parseInt(v.color),
                    transparent:true,
                    opacity:0.5
                });
                mesh=new THREE.Mesh(geo,mat);
                parametrosForma=" radio = "+v.radio;
                break;    
                
            case "piramide":
                var geo=new THREE.ConeBufferGeometry( Math.sqrt(2)*v.base/2, v.altura,4 );
                geo.rotateY(Math.PI/4);
                geo.translate(0,v.altura/2,0);
                var mat = new THREE.MeshPhongMaterial({
                    "color":parseInt(v.color),
                    transparent:true,
                    opacity:0.5
                });
                mesh=new THREE.Mesh(geo,mat);
                parametrosForma=" dimensiones  base = "+v.base+", altura = "+v.altura+"<br>";
                
                break;   

            default:
                mesh=null;
            break;
        }

        if (mesh){
            htmlObjetos+="<li><strong>"+k+" ("+v.tipo+')<div class="rectangulo" style="background-color:#'+v.color.replace("0x","")+'"></div></strong><br>';
            htmlObjetos+="posicion  = ("+v.posicion[0]+","+v.posicion[2]+","+v.posicion[1]+") <br>";
            if (v.rotacion) htmlObjetos+="rotacion sobre Y  = "+v.rotacion+" grados <br>";
            htmlObjetos+=parametrosForma;
            htmlObjetos+="</li>"

            mesh.position.set(v.posicion[0],v.posicion[2],v.posicion[1]);

            var pv=pivot.clone();
            pv.position.copy(mesh.position);
            scene2.add(pv);
            if (v.rotacion) mesh.rotation.y=v.rotacion*Math.PI/180
            scene.add(mesh);
        }
    })

    html2="<h3>Objetos</h3><ul>"+htmlObjetos+"</ul>";
    html2+=" <p><i>* Los centros de coordenadas de cada modelo estan indicados con el icono +</i><br>";
    //html+="<i>Los lados de la piramide y el cubo estan alineados con los planos coordenados</i></p>";

    $("#descripcion").html("<table><tr><td>"+html1+"</td><td>"+html2+"</td></tr></table>")
    render();
}



/*
function onResize(){
    w=$container.width();
    h=$container.height();
    var aspect=w/h;
    camGlobal.aspect=aspect;
    renderer.setSize(w,h);
    camGlobal.updateProjectionMatrix();    
}
*/

function render() {

    requestAnimationFrame(render);  

    for (i=0;i<=3;i++){

        var offX=(i%2)*w/2;
        var offY=Math.floor(i/2)*h/2;
        //console.log(i+" "+offX+" "+offY)

        if (i==0 || i==2) gridHelper2.visible=false;
        else gridHelper2.visible=true;

        
        if (i==2) planoProyeccion.visible=false;
        else planoProyeccion.visible=true;

        renderer.setViewport( offX,offY, w/2-1, h/2-1);
        renderer.setScissor( offX,offY,w/2-1,h/2-1 );
        renderer.setScissorTest( true );
        //renderer.setClearColor( view.background );
        renderer.clear();
        renderer.render(scene, cameras[i]);      
        renderer.clearDepth();
        renderer.render(scene2, cameras[i]); 
    }

}

start();
buildScene();
