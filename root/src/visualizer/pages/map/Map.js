/**
 * Created with IntelliJ IDEA.
 * Updated: 19/02/13
 * User: ejsepra
 * Date Created: 11/01/13
 * Time: 13:10
 */

define([
    "Titan",
    './MapView',
    '$',
    '_'
], function (Titan, View, $, _) {

    return Titan.Presenter.extend({
        init: function () {
            _.bindAll(this,'renderTree','expandChildrenNodes','collapseChildrenNodes', 'filterSingleValues', 'filterObjectValues',
                'parseLandscape','discoverNodes','createSubTree','createSubList', 'setupMouseEvents','animateParentChain',
                'updateTree','updateNodes','updateLinks','normalizeMaxLabelLength','getNodeXPosition',
                'mapPath','plot_drag','filterPath', 'getProperties','transform','translate','timeStamp',
                'exitHelp','resetZoom','setupZoomEvents');

            this.view = this.create(View);
            this.data = this.options.data;
            this.parsed_json = this.parseLandscape(this.data);

            this.responsiveTreeLayout();
            this.resetZoom();
            this.renderTree();
            this.timeStamp();
            this.exitHelp();

            //Iterates through all of the children
            this.root.children.forEach(this.collapseChildrenNodes);
            this.updateTree(this.root);
            this.setupZoomEvents();
        },
        exitHelp: function() {
            var helpBox = Titan.d3.element(this.view['exit-button']);
            helpBox.on('click', function(){
                $('.visualizer-map-helpbox').hide();
            });
            var treeDiv = Titan.d3.element(this.view['tree']);
            treeDiv.on('click', function(){
                $('.visualizer-map-helpbox').hide();
            });
        },
        responsiveTreeLayout: function(){
            window.onresize = function() {
                var browserWidth = parseInt(window.innerWidth),
                    result = browserWidth - 450;
                $('.visualizer-map-holder').width(result);
                $('.visualizer-map-tree').width(result);
                $('.visualizer-map-tree svg').width(result);
                $('.visualizer-map-tree svg g.container rect.overlay').attr('width',function(){
                    if(result < 0){return 0;}
                    return result;
                });
                $('.visualizer-map-tree svg').find('rect#clip-rect').attr('width',function(){
                    if(result < 0){return 0;}
                    else{return result;}
                });
            };
        },
        renderTree: function(){
            //Setup the Tree Container
            this.margin = {top: 0, right: 0, bottom: 0, left: 5};

            this.size = {
                "width": 920 - this.margin.right - this.margin.left,
                "height": 600 - this.margin.top - this.margin.bottom
            };

            this.i = 0;
            this.duration = 500;
            this.root = this.parsed_json;
            this.root.x0 = this.size.height / 2;
            this.root.y0 = 0;

            //X and Y Coordinates for Scaling the Tree
            this.x = Titan.d3.scale.linear()
                .domain([0, this.size.width])
                .range([0, this.size.width]);

            this.y = Titan.d3.scale.linear()
                .domain([0, this.size.height])
                .nice()
                .range([0, this.size.height])
                .nice();

            this.dragged = this.selected = null;

            //Creates Tree
            this.tree = Titan.d3.layout.tree()
                .size([this.size.height, this.size.width]);

            //Renders links
            this.diagonal = Titan.d3.svg.diagonal()
                .projection(function (d) {
                    var update_dy = this.x(d.y),
                        update_dx = this.y(d.x);
                    return [update_dy, update_dx];
                }.bind(this));

            //Main object container for the Tree
            this.svgRoot = Titan.d3.element(this.view['tree'])
                .append("svg")
                .attr("width", this.size.width + this.margin.right + this.margin.left)
                .attr("height", this.size.height + this.margin.top + this.margin.bottom);

            //Creates a container to hold the highlighted paths
            this.svgRoot.append("svg:clipPath")
                .attr("id", "clipper")
                .append("svg:rect")
                .attr('id', 'clip-rect');

            this.layoutRoot = this.svgRoot
                .append("svg:g")
                .attr("class", "container")
                .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

            this.layoutRoot
                .append('svg:rect')
                .attr("class", "overlay")
                .attr("width", this.size.width + this.margin.right + this.margin.left)
                .attr("height", this.size.height + this.margin.top + this.margin.bottom)
                .attr('fill', 'white')
                .on("mousedown.drag", this.plot_drag());


            this.highlightedPaths = this.layoutRoot.append("svg:g")
                .attr("clip-path", "url(#clipper)");

            this.nodeClosed = [{"x":0,"y":-3},{"x":0,"y":3}];
            this.nodeOpen = [{"x":-3,"y":0},{"x":3,"y":0}];

            this.lineFunction = Titan.d3.svg.line()
                .x(function(d) {return d.x;})
                .y(function(d) {return d.y;})
                .interpolate("linear");
        },
        updateTree: function(source){
            // Compute the new tree layout, from last nodeGroup to parent nodeGroup.
            this.nodes = this.tree.nodes(this.root).reverse();

            // Normalize links fixed-depth, links will never exceed 90px wide.
            this.nodes.forEach(function (d) {
                d.y = d.depth * 90;
            });

            //Normalize labels width, on each level of depth. Takes the widest label and
            //applies it to that width to all text fields on that level of depth.
            this.normalizeMaxLabelLength();

            //updateTree Nodes and Links
            this.updateNodes(source);
            this.updateLinks(source);

            if (Titan.d3.event && Titan.d3.event.keyCode) {
                Titan.d3.event.preventDefault();
                Titan.d3.event.stopPropagation();
            }

            // Stash the old/previous positions for transition.
            this.nodes.forEach(function (d) {
                d.x0 = d.x;
                d.y0 = d.y;
            });
            this.setupMouseEvents();
        },

        normalizeMaxLabelLength: function(){
            //Have to create a temporary text field on the page to get the computed text length
            //It is then removed and stored in the object itself as d.;abelLength
            var maxDepth = [];
            this.nodes.forEach(function (d){
                var currentDepth = d.depth,
                    labelHolder = null;
                if(d.depth === currentDepth){
                    maxDepth.push(currentDepth);
                }
                if(labelHolder){
                    labelHolder.empty();
                }
                labelHolder = $('.labelHolder').text(d.name);
                var el = $(labelHolder);
                d.labelLength = el.width() + 5;
                labelHolder.empty();
            });
            //Get unique depths in the tree
            var uniqueDepth = _.uniq(maxDepth).sort(),
                nodesWithNewDepth = [];

            uniqueDepth.forEach(function(){
                nodesWithNewDepth.push([]);
            });
            //Add all the label lengths corresponding to their depth level to the array
            this.nodes.forEach(function(d) {
                nodesWithNewDepth[d.depth].push(d.labelLength);
            });
            //Get the Maximum depth of each label in all of the open nodes and it to an array
            var maxLabelLengthList = [];
            nodesWithNewDepth.forEach(function(i){
                var largest = Math.max.apply(Math, i);
                maxLabelLengthList.push(largest);
            });
            //Add MaxLabelLength to the corresponding labels at their respective depths
            this.nodes.forEach(function (d){
                d.maxLabelLength = maxLabelLengthList[d.depth];
            });
            this.nodes.forEach(function (d){
                d.maxLabelLengthList = maxLabelLengthList;
                d.offsetLabel = d.maxLabelLength;
            });
        },
        getNodeXPosition: function(d){
            var nodeXPosition = 0,
                depth = d.depth+1;
            for(var i= 0; i< depth ;i++){
                nodeXPosition += d.maxLabelLengthList[i];
            }
            return nodeXPosition;
        },
        updateNodes: function(source){
            // updateTree the nodes…select all nodes and apply an ID if it doesn't already have one
            this.nodeGroup = this.layoutRoot.selectAll("g.node")
                .data(this.nodes, function (d) {
                    return d.id || (d.id = ++this.i);
                }.bind(this));

            // Enter any new nodes at the parent's previous position,
            // this includes the function to use the dynamic width of each node.
            // Called when the nodes are created.
            this.nodeEnter = this.nodeGroup.enter().append("g")
                .attr("class", "node")
                .attr("transform", function (d) {
                    var update_dy = this.x(source.y0) + this.getNodeXPosition(d);
                    var update_dx = this.y(source.x0);
                    return "translate(" + update_dy + "," + update_dx + ")";
                }.bind(this));

            this.nodeEnter.append("circle")
                .attr("r", 1e-6)
                .style("fill", function (d) {
                    return d._children ? "#5f5b5a" : "#ffffff";
                });

            this.nodeEnter.append("path")
                .attr("class", "link-underline")
                .attr("d", this.lineFunction(this.nodeOpen));

            this.nodeEnter.append("path")
                .attr("class", "link-underline2")
                .attr("d", this.lineFunction(this.nodeClosed))
                .classed("link-underline2-showing", function (d) {
                    return !d._children;
                });

            this.nodeEnter.append("text")
                .attr("x", function (d) {
                    var offsetLabel = d.maxLabelLength;
                    return -offsetLabel;
                })
                .attr("dy", "0.30em")
                .attr("text-anchor", function (d) {
                    return "start";
                })
                .text(function (d) {
                    return d.name;
                })
                .style("fill-opacity", 1e-6);

            // Transition/Move nodes to their new positions.
            // Called when the nodes positions are updated.
            this.nodeUpdate = this.nodeGroup.transition()
                .duration(this.duration)
                .attr("transform", function (d) {
                    var update_dy = this.x(d.y) + this.getNodeXPosition(d);
                    var update_dx = this.y(d.x);
                    return "translate(" + update_dy + "," + update_dx + ")";
                }.bind(this));

            this.nodeUpdate.select("circle")
                .attr("r", 5.5)
                .style("fill", function (d) {
                    return "#5f5b5a";
                });
            Titan.d3.selectAll("circle")
                .classed("empty", function (d) {
                    return !!(d._children == undefined && d.children == undefined);
                });

            this.nodeUpdate.select("text")
                .style("fill-opacity", 1)
                .attr("x", function (d) {
                    var offsetLabel = d.maxLabelLength;
                    return -offsetLabel;
                });

            // Transition/Move exiting nodes to the parent's new position.
            // Called when the nodes collapse.
            this.nodeExit = this.nodeGroup.exit().transition()
                .duration(this.duration)
                .attr("transform", function (d) {
                    var nodeXPosition = 0;
                    for(var i= 0; i< d.depth ;i++){
                        nodeXPosition += d.maxLabelLengthList[i];
                    }
                    var update_dy = this.x(source.y) + nodeXPosition;
                    var update_dx = this.y(source.x);
                    return "translate(" + update_dy + "," + update_dx + ")";
                }.bind(this))
                .remove();

            this.nodeExit.select("circle")
                .attr("r", 1e-6);

            this.nodeExit.select("text")
                .style("fill-opacity", 1e-6);
        },
        updateLinks: function(source){
            // updateTree the links…
            this.linkGroup = this.layoutRoot
                .selectAll("path.link")
                .data(this.tree.links(this.nodes), function (d) {
                    return d.target.id;
                });

            // Enter any new links at the parent's previous position.
            this.linkGroup.enter()
                .insert("path", "g")
                .attr("class", "link")
                .attr("d", function () {
                    var o = {x: source.x0, y: source.y0, depth: source.depth, maxLabelLengthList: source.maxLabelLengthList };
                    return this.diagonal({source: o, target: o });
                }.bind(this));

            // Transition links to their new position.
            this.linkGroup
                .transition()
                .duration(this.duration)
                .attr("d", this.diagonal);

            // Transition exiting nodes to the parent's new position.
            this.linkGroup.exit().transition()
                .duration(this.duration)
                .attr("d", function () {
                    var o = {x: source.x, y: source.y, depth: source.depth, maxLabelLengthList: source.maxLabelLengthList};
                    return this.diagonal({source: o, target: o});
                }.bind(this))
                .remove();
        },
        setupMouseEvents: function(){
            //Hover the nodeGroup element
            var self = this;
            this.nodeGroup
                .on("click", function (d)
                {
                    //Expand children
                    self.expandChildrenNodes(d);
                    //Highlight currently select node
                    Titan.d3.selectAll("circle").classed("selected", false);
                    Titan.d3.select(this).select("circle").classed("selected", true);
                    //Discover path from child to root, then create a text based path-link
                    self.filterPath(d);
                    self.mapPath(self.ancestors);
                    self.getProperties(d);
                });
            this.view['propertiesBody']
                .on('mouseover', function()
                {
                    Titan.d3.select(this).classed( "hover", true);

                })
                .on('mouseout', function()
                {
                    Titan.d3.select(this).classed("hover", false);
                })
        },
        setupZoomEvents: function() {
            this.zoom = Titan.d3.behavior
                .zoom()
                .x(this.x)
                .y(this.y)
                .scaleExtent([1,3]);
            this.layoutRoot
                .call(this.zoom.on("zoom", this.redraw()))
                .on("click.drag", null)
                .on("click.zoom", null)
                .on("dblclick.zoom",null)
                .on("mouseup.drag", this.mouseup());
        },
        mapPath: function(ancestors){
            //This section of code is used to display the path of the tree
            var pathString = "";
            var linksAncestors = ancestors.reverse();
            var length = linksAncestors.length - 1;
            var lastObject = "<span>" + linksAncestors[length].name + "</span>" + "/";

            if (linksAncestors[length].name == "/"){
                lastObject = "<span>" + linksAncestors[length].name + "</span>";
            }

            //Cuts last object off linkAncestors as it is is now placed in lastObject
            linksAncestors.pop();

            for (var index in linksAncestors) {
                pathString += linksAncestors[index].name + "/";
            }
            //This function is used to remove the "/"
            this.deleteCharAt = function( str, index )
            {
                return str.substring( 0, --index ) + str.substring( ++index );
            }

            //Condition put here in case the root node is not "/"
            if (typeof linksAncestors[0] == 'undefined' || linksAncestors[0].name == "/") {
                pathString =  ( this.deleteCharAt( pathString, 2 ) );
            }
            var path = this.view['dynamicPath'];
            path.html(pathString + lastObject);
            this.pathText = path.text();
        },
        getProperties: function(d) {
            var pathText = this.deleteCharAt(this.pathText, 1);
            var finalPathText = this.deleteCharAt(pathText, pathText.length);
            var displayName = this.view['nodeName'];
            var displayStatus = this.view['status'];
            var displaySingleValues = this.view['singleValues'];
            var displayObjectValues = this.view['objectValues'];

            if (this.pathText === "/") {
                displayName.html("");
                displayStatus.html("");
                displaySingleValues.html("");
                displayObjectValues.html("");
            }
            else {
                $.getJSON("/DeploymentManagementService-war/dmtservice/properties(" + finalPathText + ")", function(data) {

                    var propertyOrder = {1: "deletable",2: "origin",3: "status_history", 4: "properties", 5: "configuration"};
                    var orderedArray = [];

                    for (var priority in propertyOrder) {
                        for (var index in data){
                            if (propertyOrder[priority] == index) {
                                orderedArray.push(data[index]);
                            }
                        }
                    }

                    var SortedData = function(deletable, origin, status_history, properties, configuration) {
                        this.Deletable = deletable;
                        this.Origin = origin;
                        this.Status_History = status_history;
                        this.Properties = properties;
                        this.Configuration = configuration;
                    }

                    var prioritisedData = new SortedData(orderedArray[0], orderedArray[1], orderedArray[2], orderedArray[3], orderedArray[4]);
                    var result = this.filterSingleValues(prioritisedData);
                    var objectResult = this.filterObjectValues(prioritisedData);

                    displayName.html(d.name);
                    displayStatus.html("Status <span>" + data.status + "</span>");
                    displaySingleValues.html(result);
                    displayObjectValues.html(objectResult);
                }.bind(this));
            }
        },
        filterSingleValues: function(object){
            var parentList  = $("<ul>");
            for (var index in object) {
                if ( object[index] === "") {
                    parentList.append("<li><h3>"+ index + '</h3> <h2>""</h2>' +"</li>");
                    delete object[index];
                }
                if (typeof object[index] === 'undefined') {
                    parentList.append("<li><h3>"+ index + "</h3> <h2>'undefined'</h2>" +"</li>");
                    delete object[index];
                }
                else if (typeof object[index] === "string" || typeof object[index] === "int" || typeof object[index] === 'boolean' || object[index] === null) {
                    parentList.append("<li><h3>"+index + "</h3> <h2>" + object[index]+"</h2></li>");
                    delete object[index];
                }
            }
            return parentList;
        },
        createSubList: function(list) {
            return list;
        },
        filterObjectValues: function(object){
            var parentList  = $("<ul>");
            for (var index in object) {
                if (typeof object[index] === 'object' && object[index] != null) {
                    var subList;
                        parentList.append("<li><span class='mainProperty'>" + index +"</span></li>");
                    subList = this.createSubList(this.filterObjectValues(object[index]));
                    parentList.append(subList);
                }
                else if ( object[index] === null) {
                    parentList.append("<li><div>"+ index + "</div> null" +"</li>");
                }
                else if (typeof object[index] === 'undefined') {
                    parentList.append("<li><div>"+ index + "</div> <span class='subProperty'>'undefined'</span>" +"</li>");
                }
                else if (object[index] === "") {
                    parentList.append("<li><div>"+ index + '</div> <span class="subProperty">""</span>' +"</li>");
                }
                else if (typeof object[index] === "string" || typeof object[index] === "int" || typeof object[index] === 'boolean') {
                    parentList.append("<li><div>"+index + "</div> <span class='subProperty'>" + object[index]+"</span></li>");
                }
            }
            return parentList;
        },
        resetZoom: function() {
            var resetZoomBtn = Titan.d3.element(this.view['zoom-btn']);
            var self = this;
            resetZoomBtn.on('click', function(){
                self.zoom.scale(1);
                self.zoom.translate([0, 0]);
                self.updateTree(this.root);
                self.highlightedPaths
                    .selectAll("path.selected")
                    .transition()
                    .duration(self.duration)
                    .attr("d", self.translate);
            });
        },
        filterPath: function(d){
            // Walk parent chain
            this.ancestors = [];
            var parent = d;
            this.currentParent = d;
            while (parent !== undefined) {
                this.ancestors.push(parent);
                parent = parent.parent;
            }
            //Get all Node Text Labels and Filter them out, this is based on the selected child path to the root.
            this.layoutRoot.selectAll("g.node text")
                .classed("selected",false)
                .filter(function(d)
                {
                    return _.any(this.ancestors, function(p)
                    {
                        return p.id === d.id;
                    });
                }.bind(this))
                .each(function()
                {
                    //Apply highlighting to text label
                    Titan.d3.select(this).classed("selected",true);
                });
            //Get all Node Circles and Filter them based on the selected child path to the root.
            this.layoutRoot.selectAll("g.node circle")
                .classed("selected",false)
                .filter(function(d)
                {
                    return _.any(this.ancestors, function(p)
                    {
                        return p.id === d.id;
                    });
                }.bind(this))
                .each(function()
                {
                    //Apply highlighting to text label
                    Titan.d3.select(this).classed("selected",true);
                });

            this.matchedLinks = [];
            //Get all Path Links and Filter them out based on the selected child to parent.
            this.layoutRoot.selectAll("path.link")
                .filter(function(d)
                {
                    return _.any(this.ancestors, function(p)
                    {
                        return p === d.target;
                    });
                }.bind(this))
                .each(function(d)
                {
                    this.matchedLinks.push(d);
                }.bind(this));
            this.animateParentChain(this.matchedLinks);
        },
        animateParentChain: function(links){
            //remove any existing paths
            this.highlightedPaths.selectAll("path.selected")
                .data([])
                .exit().remove();

            //selects the links and adds class "selected"
            this.highlightedPaths
                .selectAll("path.selected")
                .data(links)
                .enter().append("svg:path")
                .attr("class", "selected")
                .attr("d", this.diagonal);

            //returns bounding box of nodes
            var overlayBox = this.svgRoot.node().getBBox();

            //Add container for all highlighted links
            this.svgRoot.select("#clip-rect")
                .attr("x", overlayBox.x + overlayBox.width)
                .attr("y", overlayBox.y)
                .attr("width", 0)
                .attr("height", overlayBox.height)
                .transition().duration(500)
                .attr("x", overlayBox.x)
                .attr("width", overlayBox.width);
        },
        expandChildrenNodes: function(d) {
            //Opens children
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
            Titan.d3.selectAll("path.link-underline2")
                .classed("link-underline2-showing", function (d) {
                    return !d._children;
                });
            this.updateTree(d);
        },
        collapseChildrenNodes: function(d){
            if (d.children) {
                //d._Children are hidden, d.Children are visible
                d._children = d.children;
                d._children.forEach(this.collapseChildrenNodes);
                d.children = null;
            }
           Titan.d3.selectAll("path.link-underline2")
                .classed("link-underline2-showing", function (d) {
                    return !d._children;

                });
        },
        createSubTree: function(name, children){
            var subtree = {};

            subtree["name"] = name;
            if (children != null && children.length > 0) {
                subtree["children"] = children;
            }
            return subtree;
        },
        discoverNodes: function(nodeGroup, depth, maxdepth){
            var children = [];

            for (var key in nodeGroup) {
                if (nodeGroup.hasOwnProperty(key)) {
                    var child_node = nodeGroup[key];
                    if (child_node != null && typeof child_node == "object"
                        && !(child_node instanceof Array)) {
                        var subtree;
                        if (depth <= maxdepth) {
                            subtree = this.createSubTree(key, this.discoverNodes(child_node, depth + 1, maxdepth)),this;
                        } else {
                            subtree = this.createSubTree(key, []), this;
                        }
                        children.push(subtree);
                    } else {
                        children.push(this.createSubTree(key, null)),this;
                    }
                }
            }
            return children;
        },
        parseLandscape: function(data){
            var tree = null;
            var discovered = this.discoverNodes(data, 1, 15);
            // Add a top-level nodeGroup.
            tree = {
                "name": "/"
            };
            tree["children"] = discovered;
            return tree;
        },
        plot_drag: function() {
            return function() {
                Titan.d3.select('body').style("cursor", "url('data:image/gif;base64,AAACAAEAICACAAcABQAwAQAAFgAAACgAAAAgAAAAQAAAAAEAAQAAAAAAAAEAAAAAAAAAAAAAAgAAAAAAAAAAAAAA////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8AAAA/AAAAfwAAAP+AAAH/gAAB/8AAAH/AAAB/wAAA/0AAANsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//////////////////////////////////////////////////////////////////////////////////////gH///4B///8Af//+AD///AA///wAH//+AB///wAf//4AH//+AD///yT/////////////////////////////8='), move");
            }
        },
        mouseup: function() {
            return function() {
                document.onselectstart = function() { return true; };
                Titan.d3.select('body').style("cursor", "auto");
                if (this.dragged) {
                    this.dragged = null
                }
            }.bind(this);
        },
        redraw: function() {
            return function() {
                this.nodeGroup.attr("transform", this.transform);
                this.linkGroup.attr("d", this.translate);
                this.highlightedPaths.selectAll("path.selected").attr("d", this.translate);
            }.bind(this)
        },
        transform: function(d) {
            var sourceX = this.x(d.y) + this.getNodeXPosition(d);
            var sourceY = this.y(d.x);
            return "translate(" + sourceX + "," + sourceY + ")";
        },
        translate: function(d) {
            var depth = d.source.depth+1;
            var nodeXPosition = 0;
            for(var i= 0; i< depth ;i++){
                nodeXPosition += d.source.maxLabelLengthList[i];
            }
            var sourceX = this.x(d.target.parent.y) + nodeXPosition;
            var sourceY = this.y(d.target.parent.x);
            var targetX = this.x(d.target.y) + nodeXPosition;
            var targetY = (sourceX + targetX) / 2;
            var linkTargetY = this.y(d.target.x0);
            return "M" + sourceX + "," + sourceY + "C" + targetY + "," + sourceY + " " + targetY + "," + this.y(d.target.x0) + " " + targetX + "," + linkTargetY + "";
        },

        timeStamp: function() {
            var currentTime = new Date();
            var hours = currentTime.getHours();
            var minutes = currentTime.getMinutes();
            var day = currentTime.getDate();
            var month = currentTime.getMonth() + 1;
            var year = currentTime.getFullYear();
            var date = day + "/" + month + "/" + year;
            if(hours < 10){
                minutes = "0" + minutes;
            }
            if(minutes < 10){
                minutes = "0" + minutes;
            }
            var time = hours + ":" + minutes;
            var tStamp = this.view['timeStamp'];
            tStamp.html(time + " " + date);

        }
    });
});