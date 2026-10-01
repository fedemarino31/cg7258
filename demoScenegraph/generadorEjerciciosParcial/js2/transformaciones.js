

var $window=$(window);    
var $container = $('#container3D');

var renderer,camera,scene;   
var horizontalWidth=300;

var diagram;
var nodeDataArray=[];
var linkDataArray=[];

var SHOW_AXIS=true;
var modelFile="ejercicios/2c2021/transformaciones11.json"

var nodeId=0;

function start(){

    
    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize($container.width(), $container.height());
    renderer.setClearColor(0xEEEEEE);
    
    var aspect=$container.width()/$container.height();
    
    camera=new THREE.OrthographicCamera(-10,10,-10,10,-100,100);
    camera.position.set(0,-30,1);
    camera.lookAt(new THREE.Vector3(0,-30,0));

    scene = new THREE.Scene();
    
    $container.append(renderer.domElement);
    $window.resize(onResize);
    onResize();

    

    var ambienLight=new THREE.AmbientLight(0x222266);
    scene.add(ambienLight);

    var gridHelper = new THREE.GridHelper( 200,20,
        new THREE.Color(0xAAAAAA),new THREE.Color(0xCCCCCC) );
    gridHelper.rotation.x=Math.PI/2;
    scene.add( gridHelper );

    var axesHelper = new THREE.AxesHelper( 10 );
    //scene.add( axesHelper );

    map1 = new THREE.TextureLoader().load( 'textures/map1.png' );
    map1.minFilter=THREE.NearestFilter

    var $go = go.GraphObject.make;
    diagram=$go(go.Diagram, "diagram");

    diagram.nodeTemplate =
    $go(go.Node, "Auto",
      new go.Binding("location", "loc", go.Point.parse),
      $go(go.Shape, "RoundedRectangle", { fill: "lightgray" }),
      $go(go.TextBlock, { margin: 5 },
        new go.Binding("text", "label")),
        new go.Binding("fill", "color")
    );

    diagram.linkTemplate =
    $go(go.Link,
      $go(go.Shape,  { strokeWidth: 1, stroke: 'grey' }),
      $go(go.Shape, { toArrow: "Standard" }),
      $go(go.TextBlock, { alignmentFocus: new go.Spot(-0.1, 0, 0, 0) },
        new go.Binding("text", "text"))
    );
    
   diagram.layout=$go(go.TreeLayout,{
        angle: 90,
         layerSpacing: 70,
          nodeSpacing:100});

}

function buildScene(){
    /*
    var geometry = new THREE.CircleBufferGeometry( 50, 64 );
    var material = new THREE.MeshBasicMaterial( {color: 0x0000FF} );
    var cylinder = new THREE.Mesh( geometry, material );
    
    cylinder.matrixAutoUpdate=false;

    var m1=new THREE.Matrix4();
    m1.makeTranslation(50,0,0);
    cylinder.matrix=m1;
    scene.add( cylinder );
    */
    
}

var formas={};
var geometry;
var zIndex=0;

function loadModel(){
    $("#titulo").html(modelFile);

    $.ajax(modelFile).done(function(data){
        //console.log(data);
        
        $.each(data.formas,function(k,v){
        
            switch(v.tipo){
                case "circulo":
                    var r=parseFloat(v.radio);
                    geometry = new THREE.CircleBufferGeometry( r, 32 );

                break;
                case "rectangulo":
                    var an=parseFloat(v.ancho);
                    var al=parseFloat(v.alto);
                    geometry = new THREE.PlaneBufferGeometry( an, al, 32 );

                break;
                case "triangulo":
                    var b=parseFloat(v.base);
                    var h=parseFloat(v.altura);
                //   geometry = new THREE.CircleBufferGeometry( r, 3,Math.PI/2 );        

                    var geometry = new THREE.BufferGeometry();
                    // create a simple square shape. We duplicate the top left and bottom right
                    // vertices because each vertex needs to appear once per triangle.
                    var vertices = new Float32Array( [
                        -b/2, 0, 0,
                        b/2, 0, 0,
                        0, h, 0                    
                    ] );

                    var uvs = new Float32Array( [
                        0, 0,
                        1, 0,
                        0.5, 1,                   
                    ] );                    
                    
                    // itemSize = 3 because there are 3 values (components) per vertex
                    geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
                    geometry.addAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );


                    
                break;                      
            
            }

            var material=new THREE.MeshBasicMaterial({
                color:parseInt(v.color),
                map:map1,                    
            });

            formas[k]=new THREE.Mesh(geometry,material);



            if (v.pivot){
                geometry.translate(-v.pivot[0],-v.pivot[1],0);
            }


            
            formas[k].userData=v;
            
            if (SHOW_AXIS){
                var ax=new THREE.AxesHelper(10)
                ax.position.z=1;    
                formas[k].add(ax);
            }
                
        })

        agregarNodo(data.arbol);
        
        diagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
        dibujarFormas();

    })
}


function parseTransform(string){

    var tipo=string.charAt(0);
    var m=new THREE.Matrix4();

    switch(tipo){
        case "T":
            var nums=string.substring(1).replace("(","").replace(")","").split(",");
            var x=parseFloat(nums[0]);
            var y=parseFloat(nums[1]);    
            
            m.makeTranslation(x,y,0);
        break;
        case "E":
            var nums=string.substring(1).replace("(","").replace(")","").split(",");
            var x=parseFloat(nums[0]);
            var y=parseFloat(nums[1]);      
            m.makeScale(x,y,1);
        break;
        case "R":
            var num=parseFloat(string.substring(1).replace("(","").replace(")",""));
            m.makeRotationZ(num*Math.PI/180);            
        break;
    }
    return m;
    
}

function parseTransforms(string){
    var partes=string.split("*");
    var m1=new THREE.Matrix4();
    $.each(partes,function(i,v){
        var m2=parseTransform(v);
        m1.multiply(m2);
    })
    return m1;
}

function getNodeId(){
    n=nodeId;
    nodeId++;
    return n;
}

function agregarNodo(nodo,padre){

    var keyForma;
    var obj;
    var raizId;
    var thisNodeId;

    if (!nodo.forma) {
        // es un container
        obj=new THREE.Object3D();    
        if (SHOW_AXIS){
            var ax=new THREE.AxesHelper(10)
            ax.position.z=1;    
            obj.add(ax);
        }
    } else {
        // es una forma
        keyForma=nodo.forma;
        obj=formas[keyForma].clone();        
    }
    obj.matrixAutoUpdate=false;

    if (nodo.t){// tiene transformacion
        var m=parseTransforms(nodo.t);

        var m2=new THREE.Matrix4();
        m2.makeTranslation(0,0,zIndex);
        zIndex++;
        m.premultiply(m2);
        obj.matrixAutoUpdate=false;
        obj.matrix=m;
    }
    
    if (!padre) {
        // defino el nodo Raiz y lo agrego al diagrama
        raizId=getNodeId();   
        nodeDataArray.push({"key":raizId,"label":"Raíz"});  
        console.log("agregar nodo, id: "+raizId+" forma:Raíz")   
        thisNodeId=getNodeId();  
        linkDataArray.push({
            from: raizId,
            to:thisNodeId,
            text:nodo.t
        }) 
        console.log("agregar link, from:"+raizId+" to:"+thisNodeId)

        scene.add(obj);    
    } else {
        padre.add(obj);   
        thisNodeId=getNodeId();           

        
        linkDataArray.push({
            from: padre.userData.id,
            to:thisNodeId,
            text:nodo.t
        })
        console.log("agregar link, from:"+padre.userData.id+" to:"+thisNodeId)
    }

    
    obj.userData.id=thisNodeId;
    
    label="Container";
    if (nodo.forma) label=nodo.forma;
    //label+=" (id:"+thisNodeId+" nombre:"+nodo.nombre+")";
  
    
    nodeDataArray.push({"key":thisNodeId,"label":label,"color":"orange"})
    console.log("agregar nodo, id: "+thisNodeId+" forma:"+label+" t:"+nodo.t+" nombre:"+nodo.nombre)

    if (nodo.hijos){
        $.each(nodo.hijos,function(i,v){            
            agregarNodo(v,obj);            
        })
    } 
    


}

function dibujarFormas(){
    var x0=-100;
    var y0=-140;

    var left=135;
    var top=730;


    $.each(formas,function(k,v){
        var m=v.clone();
        m.position.x=x0;
        m.position.y=y0;
        scene.add(m);
        x0+=50;
        var description="";
        var info=v.userData;
        switch(info.tipo){
            case "rectangulo":
                description+="<p>ancho="+info.ancho+"<br>";
                description+="alto="+info.alto+"</p>";
                break;
            case "circulo":
                description+="<p>radio="+info.radio+"</p>";
                break;                
            case "triangulo":
                description+="<p>base="+info.base+"<br>";
                description+="altura="+info.altura+"</p>";
                break;
        }
        
        var html='<div class="label" style="top:'+top+'px;left:'+left+'px"><strong>'+k+'</strong><br>'+description+'</div>';
        left+=135;
        $container.append(html);
            
    })
}

function onResize(){
    var w=$container.width();
    var h=$container.height();
    var aspect=w/h;

    renderer.setSize(w,h);
    
    camera.left=-horizontalWidth/2;
    camera.right=horizontalWidth/2;

    camera.top=(horizontalWidth/2)/aspect;
    camera.bottom=(-horizontalWidth/2)/aspect;
   
    camera.updateProjectionMatrix();
    
}


function render() {

    requestAnimationFrame(render);   
    renderer.render(scene, camera);      

}


start();
buildScene();
loadModel();

render();