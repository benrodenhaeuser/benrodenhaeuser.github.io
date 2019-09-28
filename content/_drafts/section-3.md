---
title: Design Problems
type: major
---

## Design Problems

Bottom-up or top-down

This section aims to get some of the main problems Pen has to solve in perspective.

> - How to structure this section? 
> - Option: along main concepts
> - Option: requirements gathering
> - What are the points to be made in this section? 
{: .todo}

- How to tease out the main problems Pen has to solve? This section starts by discussing some of the fundamental concepts that the Pen application is based on: shapes, documents, edits, 
- Arguably, the fundamental concept around which an editor is structured is the document. 
- (Fundamental objects we have to model/capture)
- This section aims to tease out some of the main problems Pen has to solve, and the choices I made to addressing them. 

### Shapes

Shapes are the fundamental „unit“.  

> Bezier curves
{: .todo}

### Documents

*How are documents structured? Are they just lists of shapes?*

The user starts out with a blank slate, and goes on to use the visual editing tools and/or the markup editor to create a drawing. What should the underlying document that represents the drawing look like? Taking a cue from the feature list above, we need a data structure capable of 

- representing visual shapes in a mathematical fashion,
-  capturing ways of manipulating such shapes, e.g., as rotated or scaled, 
- expressing hierarchical relations between pieces of visual content.

The last requirement is particularly consequential. It indicates that a flat list of shapes will not be appropriate to capture the fundamental intuition that the „world“ represented by a drawing consists of things arranged in part-whole relations. Legs are body parts, the skyscraper is a part of the skyline, the wheels belong to the car. Crucially, the user will want to treat the whole in ways that are similar to the way she treats the part. She will want to be able to scale the body as a whole, not just the individual parts. This is what makes the hierarchical model useful in the first place. The entities that make up a document thas have an inherent recursive flayer, and consequently, we need a data structure that is inherently *composable* (in the sense of the Composite pattern). 

Such a structure is the scene graph. 

> Material on scene graphs in notes.
{: .todo}

What are further requirements on documents? 

*How are documents represented?* One level of representation is not enough. 

### Modes

- Effects of event types (like a `mousedown` or `mousemove`) are state-dependent.

### Session persistence

- Need a mechanism to individuate user actions as discrete *editing steps* and classify these steps by their type. This is necessary for both undo/redo and auto-save. 

A sequence of edits is a *session*. 

- Need a mechanism to individuate user actions as discrete *editing steps* and classify these steps by their type. This is necessary for both undo/redo and auto-save. 

*How are documents stored?*

> Text
{: .todo}

### Global persistence

*How are documents edited?*

The whole point of an editing-oriented application is to make documents dynamic at run-time: users should be able to not just view documents, but edit them. As the feature list from the previous section makes clear, we want to support both a visual canvas, and a markup editor as sources of application dynamics. This means that we have to be able to respond to a broad variety of user events as application inputs. 

Given that we want user edits

The challenge is to find a uniform model 

## Design Problems

This section aims to get the main problems an application like Pen has to solve in perspective. 

{::comment }
> The above feature list talks about shapes and their hierarchical relations, about a canvas and a markup editor, about documents and the way they are managed. We need to find a technical language that makes these concepts amenable for computational processing. 
{:/comment }

### Drawing API
Let’s start on the fairly concrete level of the application domain: how to put a vector-based drawing on the screen? For this purpose, we need a drawing API that enables us to

1. represent visual shapes in a mathematical fashion,
2. express ways of manipulating such shapes (scale, rotate or move them), and
3. organize them in some kind of hierarchical data structure.

For the three above-mentioned tasks, established solutions are available: 

> #### Scene graphs
> The most fundamental data structure used in vector-based graphics applications is the scene graph. These are tree(-like) data structures that model relations between domain objects, based on the fundamental intuition of a world consisting of things arranged in part-whole relations. Legs are body parts, the house is a part of the neighborhood, and so on. Similarly, graphical shapes are naturally seen by the user as composed of smaller parts, and we should be able to treat such complex entities as a whole. (In applications like Illustrator, layers are wholes, and the children of a layer are the parts of which the whole is composed. In SVG, layers are called groups. SVG can thus be seen as a language for describing scene graphs.)
> #### Matrix transformations
> As pointed out above, a main point of the scene graph data structure is to make it easy to manipulate parts that belong together as a whole. In mathematical terms, such transformations can be implemented by means of matrix multiplication. To transform a shape or group in two-dimensional space by means of a rotation, e.g., we can multiply the current transformation matrix of the shape or group with another matrix representing the rotation angle, and the center of rotation.
> #### Bezier curves
> The leaf nodes in a scene graph consist of shapes that are defined mathematically. Bezier curves are a dominant paradigm in 2D vector applications like Illustrator, Sketch and the like. Bezier curves are specified by a number of anchor points and handle that determine parametrized curves. They may be composed to splines consisting of several such curves. The SVG path syntax relies on such curves.

### Document structure

Basics
- Represent shapes
- Allow to manipulate shapes and groups of shapes
- Easy to render
- Take into account hierarchical relations between shapes: compose shapes into groups and be able to treat the group as a single whole
- Not tied up to a particular rendering engine (why?)
- Extensible: besides grouping as an operation for composing shapes, there are more advanced operations like intersecting shapes or taking their union (*Boolean operations*), or using one shape as a clipping mask for another
- While Pen does not implement these features, we require extensibility in the sense that implementing some of these advanced features should not force us to start from scratch

*Solution:* scene graph that uses Bezier curves to represent primitive shapes, groups to represent wholes composed of smaller parts, and matrix transformations as a means of expressing manipulations to those shapes. 

In Gang of Four terminology, this is an instance of the „Composite Pattern“ 

Need a diagram here showing a simple document, or perhaps an object representation alongside with a visual representation.

Document representations:
- Above is very high-level. 
- Given a document, we want to be able to generate various representations of it. 
- In particular, we need to be able to generate a canvas representation and a markup representation, and a serialized representation that can be persisted to a data store of some kind.
- Need to ensure canvas and markup representation are in sync.

- To actually render the current state of a document to the screen, we need to convert it to something the rendering engine understands.

*Solution:* Our rendering engine is the browser. Since the browser natively supports SVG, all we really need to do is to convert our internal data structure to SVG DOM nodes, and the browser will take care of the rest.  

- Suggests to *untie the document from the format used by the rendering engine*, because that format turns out to be just one among a multitude of representations.

### User interface
- We don’t want to be forced to fix the interface upfront. 
- Particular choices in this area tend to be ephemeral
- We don’t want to have to change internals as we change the application.

(*this is very generic*)

### Persistence layer („document management“)
- Global persistence
	- Should we go with a relational database or a document-oriented one? 
	- Auto-Save
- Session persistence
	- Needs to be fast (without network requests)
- Our notion of Undo is state-oriented rather than command-oriented.

*Solution:* Use MongoDB, since its document-oriented. Our data is strongly document-oriented, and not very relational. 

> If the data in your application has a document-like structure (i.e., a tree of one-to-many relationships, where typically the entire tree is loaded at once), then it’s probably a good idea to use a document model. [Martin Kleppmann]()

### User Events
As it turns out, the main challenges of developing Pen are *app-centric* rather than *domain-centric*. 

> Our application is strongly interactive
> Given that we have an internal representation of visual content using the above ingredients, the real work just begins. Remember that we are not …
> Still, the concepts mentioned are so clear that I was able to more or less take them off the shelf and express them in code.
> While understanding the details of these concepts takes a bit of time, there is no rocket science involved. The real challenges for an application like Pen lie in crafting the editor.
> - Event Handling
> 	- Accept a variety of inputs that change the internal state, both via mouse input on the canvas, and via keyboard input in the markup editor
> 	- Diversity of inputs
> 	- What do they mean? 
> - State Management
> 	- Complex application state
> 	- Variety of data representations: 
> 		- persistence layer
> 		- history
> 		- view
> 		- markup representation
> 		- canvas representation
> 	- Maintain the application state in some sort of useful data structure
> 	- Generate, and display a markup representation of the current scenegraph
> - Challenges: 
> 	- Complexity explosion
> 	- Have many „data formats“ representing roughly the same thing:
> 		- markup editor
> 		- drawing canvas
> 		- database storage
> 		- *keep all this stuff in sync!*
> 	- Challenges of making a vector editor in the first place
> 	- Develop a sensible data model that allows us to represent nested shapes of Bezier splines and (possibly nested) transformations applied to them. 
> 	- Manage complexity  — state management
> 	- Organize data flow to support live-sync
> 	- Optimize code so as to support short response times.
> - This is also due to the fact that I decided early on to develop Pen from scratch, rather than relying on a framework such as React or Vue. 
> - After doing a ton of research, and developing a number of small prototypes, I had developed a number of ideas for how I wanted to tackle the complexity explosion alluded to above. 
> - Should we talk about the choices we faced? Which libraries to use, which development style to pursue 
> - jQuery style/React style: the jQuery style just won’t cut it. I was afraid of being boxed in by a framework. I wanted to explore the organizational challenges that come with a project like Pen to depth.
> - jQuery has an „imperative style“, React aims at a more „declarative“, pure/functional style
> - Paper.js, Codemirror
> - Making an in-browser code editor is hard, and has little to do with our application’s core domain
> - Making an in-browser graphics editor is also kind of hard (as I found out), but more manageable, and more deeply tied to our application’s core domain
{: .notes }

*Rules of thumb:*
- Modularize the application as much as possible. 
- Keep DOM manipulation separate from core domain/application logic.

> Decision: Use an internal scene graph, and convert it into an SVG DOM as needed. Why?
> Our scene graph depicts not simply an SVG, but an editor! That is an important distinction.
{: .notes }

### Event management
- The whole point of an editing-oriented application is to make documents dynamic at run-time: users should be able to not just view documents, but change them.
- Need to support a multitude of events (keyboard, pointer device)
- Need a mechanism to individuate user actions as discrete *editing steps* and classify these steps by their type. This is necessary for both undo/redo and auto-save. 


## Problem faced

