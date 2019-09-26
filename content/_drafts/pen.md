---
title: Pen Case Study
type: major
description: Designing a vector design tool that live-syncs a drawing canvas with an SVG markup editor from scratch.
abstract: Pen is a vector design tool that live-syncs a drawing canvas with an SVG markup editor. I built it from scratch in JavaScript, developing a custom application framework based on finite state machines and the „hexagonal architecture“ pattern, with a simple Sinatra/MongoDB backend for storage.
header-image: /assets/images/pen/warnock.png
image-caption: John Warnock drawing a cubic Bezier curve.
external-links:
  github: https://github.com/benrodenhaeuser/pen 
  demo: https://pen.benrodenhaeuser.io
---

## Introduction
{: .no-toc }

Pen is a vector design application that combines the drawing canvas for visual editing typical for tools of this kind with a markup editor that represents the vector art as SVG markup.

> A bit more on why this is cool.
{: .todo}

For the most part, this case study focuses on the design problems faced in developing Pen, and the solutions I found to meet those challenges. It is thus not an introduction to putting vector graphics on the web, in particular since many excellent resources are just a Google search away. 

While implementing the business logic needed to facilitate vector editing took some time to get right, the most challenging aspects of developing Pen were related to more high-level concerns, such as state management and managing data flows. To address these challenges, I implemented a custom application framework from scratch that is strongly inspired by [hexagonal architecture][1], and differs from recent web trends embodied by more general frameworks such as React in some interesting ways. 

[Section 1]() discusses the general ideas that motivated me to develop Pen. [Section 2]() gives a rough overview of the feature set I initially set out to support. [Section 3]() aims to get some of the main problems Pen has to solve in perspective. [Section 4]() draws the results of the preceding section together in a blueprint for Pen. [Section 5]() discusses the way data flows through the Pen application. [Section 6]() goes into more depth on a number of optimizations that were necessary to speed up the application. 

> Link to sections
{: .todo}

> Conclusion? Appendix?
{: .todo}

## Motivation

This section introduces the general ideas that motivated me to develop Pen. 

### Use cases
Nowadays, many websites and web applications rely on SVG, due to its pretty unique blend of attractive features – SVGs tends to be small in terms of file size, they provide a crisp look at all screen resolutsion, they are easy to edit, and provide a good target format for animation code. 
When I started developing Pen, I had two primary use cases in mind:

- *Aid the Learning Process.* Designers that want to make the most out of SVG need to acquire a working knowledge of its markup language. While using markup as a tool for creating vector images from scratch is tedious, to say the least, having a good grasp of the way SVG works is indispensable if you want to do put it on the web as is, or even animate it. This can be a challenge, as parts of SVG markup may appear [„pretty indecipherable … a ton of numbers and letters smashed together into a long string.“][8] Pen aims to be a learning aid in this context.
- *Enhance SVG Workflows.* SVGs are typically created in a graphics editor, and prepared for use on the web in a code editor. This can create a gap between the designer’s task of creating visuals, and the developer’s task of site integration (even if designer and developer happen to be the same person). Pen aims to help bridge that gap.

So Pen aims to be both a learning tool, and help with workflows for putting SVG on the web. 

### Main idea
As mentioned above, people work with SVG from two angles, using design tools (like Sketch or Illustrator), and developer tools (like a code editor, or a build tool). In a design tool, the SVG language takes the back-seat and is hidden from the user’s view. A code editor, on the other hand, typically offers no dedicated tools for working with graphics-oriented markup. To inspect the result of styles being applied to an SVG, e.g., we need yet another tool, typically, a web browser. For this reason, I felt that a tool was needed that speaks both languages, graphics and markup. 

The idea, then, is to treat markup as a first-class citizen, on a par with graphical output. Pen allows users to directly manipulate their artwork using markup, and conversely, makes the markup representation of drawing actions immediately visible. Here is how this looks in action:

> Insert Pen interface gif here.
{: .todo}

{::comment}
![][image-1]
Pen interface featuring drawing canvas and markup editor.
{: .image .border }
{:/comment}

As the screen capture shows, the distinguishing feature of Pen is that the shapes on the drawing canvas and the elements in the markup editor *live-sync*. The user may thus, e.g., edit the stroke or fill of a shape in markup, and have the change immediately reflected on the drawing canvas.

### Inspirations
A major inspiration for the approach taken by Pen was Framer, a design tool that in its [„Classic“][9] incarnation, made some waves in the design community a couple of years ago, boasting a side-by-side representation of JavaScript code (CoffeeScript, to be precise) and an interactive prototype generated by that code:  

> Insert image depicting Framer interface here.
{: .todo}

{::comment}
![][image-2]
Framer Classic interface with layer pane (to the left), code pane (in the middle), and prototype pane.
{: .image }
{:/comment}

Another inspiration were the developer tools offered by modern browsers, that have come a long way since „View Source“. Modern DevTools offer a myriad ways of interacting with your website or web application. One possible – and, in my opinion, desirable – future path for them would be to grow into [web-based, standalone products][10] that target the needs of those who need to see the code generating the product alongside with the product itself, on an on-going basis, be it designers or developers. On a more modest scale, Pen aims for something similar. 

### Working from scratch

> Text
{: .todo}

## Features

This section gives a rough overview of the feature set I initially set out to support with the Pen project. 

### Drawing tools
From a user perspective, a design tool like Pen at the very least should provide:
- *drawing mode* (create and edit shapes on the canvas)
- *select mode* (select and transform shapes, e.g., by rotating them)
- *group/ungroup* (hierarchically organize shapes)

> Insert image demonstrating drawing tools here
{: .todo}

### Markup editing
Pen focuses on the relationship between markup and its visual output, so we will also have to provide:
- a *markup editor* with at least minimal amenities
- *two-way live-sync* between drawing canvas and markup editor

> Insert image demonstating live-sync here
{: .todo}

### Document management
In addition, users will expect to find a number of document management features in a modern in-browser application:
- *CRUD:* commit documents to storage, retrieve, update and delete them
- *auto-save:* persist changes to storage without user intervention
- *undo:* revert to previous states of the current editing session

These features lie at the intersection of what I felt was feasible and what I deemed desirable for a product that I would feel comfortable sharing with the world. A mature application will, of course, have to support both a broader feature set, and additional depth to the features mentioned.

> Insert image showing document management features here
{: .todo}

## Design Problems

This section aims to tease out some of the main problems Pen has to solve. 

### Document structure

> Text
{: .todo}

- need a data structure that is inherently *composable* (in the sense of the Gang of Four[Composite pattern][11]).

### User interface

> Text
{: .todo}

### Data storage

> Text
{: .todo}

### Event management

> Text
{: .todo}

## Application Structure

This section draws the results of the preceding analysis together in a blueprint for Pen. 

### The onion model
The high-level design I settled on is captured by an onion diagram with nested concentric circles (see below). It is heavily inspired by Alistair Cockburn’s hexagonal architecture (also known as the „ports and adapters pattern“), whose original intent was to [„allow an application to equally be driven by users, programs, automated test or batch scripts, and to be developed and tested in isolation from its eventual run-time devices and databases“][12], and to avoid an [„entanglement between the business logic and the interaction with external entities“][13], where an „external entity“ could be either the user interface or a database, or another service hooked up with the application.

> Insert onion image here.
{: .todo}

The basic idea here is that „ignorance is bliss“: inner and outer layers of the onion know as little as possible about each other, and interact via „gates“ that are as narrowly construed as possible. So what I call the onion model facilitates a strong isolation of onion layers. As described [in the next section][14], this gives us tight control over the way data flows through our application. But before going into that, this section describes the onion layers, and the role they play in Pen, from the outside moving inwards.

### The environment

- *What is it?*
	- consists of the run-time our application will run in. In our case, the run-time is the browser, so our environment is made up by the browser APIs we are going to use.
- *What role does it play in Pen?*
	- browser interfaces
		- `Event` interface, from which all state changes originate
		- the `Document` interface, which the periphery uses to mutate the DOM in line with the demands of the application core 
		- `Fetch` API to talk to our infrastructure, which actually merely consists of a very simple Sinatra/MongoDB backend
		- `History` interface, which we use as a vehicle for implementing Undo
		- `requestAnimationFrame`, which we use to synchronize internal state changes with the rendering cycle of the browser

### The periphery

- *What is it?*
	- hooks up the core with the environment. 
	- is aware of the environment, but swappable, since the core (see below) is *not* aware of the environment
	- converts external events (in particular, user events, but also incoming responses to network requests) to commands that are usable by the application. 
- *What role does it play in Pen?*

### Outer core: the application

- *What is it?*
	- the core consists of two nested layers. 
	- the outer one of these two is called „application“, while the inner one is called „domain“. 
	- despite its name, the application layer is not the actual app. 
- *What role does it play in Pen?*
	- the application layer mostly consists of a finite state machine that transitions ins response to commands that arrive from the periphery.

### Inner core: the domain

- *What is it?*
	- contains all the business logic
- *What role does it play in Pen?*
	- Holds the scene graph/editor tree. 
	- This is where the document structure described earlier is situated.
	- The editor tree is implemented as a mutable object. This goes slightly against the grain of recent trends towards immutable data structures that play an important role in frameworks such as React. This is a trade-off, since [immutability in the context of a Web app enables sophisticated change detection techniques to be implemented simply and cheaply][15], and we will have to make up for that (details below). On the other hand, working with mutable state, we gain the advantage of bundling the data that makes up our domain state with the methods operating on that data (encapsulation). Like other object-oriented languages, JavaScript facilitates this style of programming, and I will show below how we are able to handle any remaining issues.

## Data flows

This section discusses application dynamics, i.e., the way data flows through the Pen application. 

### Event loop

Here is an overview of the event loop implemented in the Pen application:

- An event occurs in the environment and is dispatched to our app. 
- This results in a previously registered callback being invoked. 
- The callback processes the event into a command that is passed to the application layer. 
- If the command is executable in the current state, the application finds a state transition corresponding to the command using the transition table.
- The machine transitions to a new state, and another callback is triggered that mutates the editor tree.
- Once that callback has run, all peripherals are notified of a recent state change by receiving a description of the state change. 
- The peripheral devices inspect the notification and decide if the state change merits their attention.
- If so, the peripheral ensures that appropriate changes are made to the environment, using one of the DOM APIs.

The description closely corresponds to a series of nested function calls (hyperlinks point to the source code):

- periphery layer: `eventListener(event)`
- application layer: `execute(command)` 
- domain layer: `invoke(update, state, command)` 
- application layer: `publish(description)` 
- periphery layer:`react(description)`

Notice how the current task originates in the environment, and moves inwards, traversing application layers all the way through the domain, and moves back outwards, to the periphery, which triggers appropriate changes in the environment.

> Insert image relating onion layers to nested function calls here
{: .todo}

### Virtual DOM

> Text
{: .todo}

### Reconciliation

> Text
{: .todo}

## Optimization

This section discusses how I optimized the data flows described above to make Pen meet the constraints imposed by the RAIL model.

### The RAIL model

> Text
{: .todo}

### Synchronizing with the rendering engine

> Text
{: .todo}

### Optimizing the app cycle

> Text
{: .todo}

## Appendix: Design Patterns

This appendix gives an overview of the GoF design patterns mentioned in this case study that are intimately related to the high-level design of Pen.

> Provide Wikipedia links for design patterns
{: .todo}

### Adapter
> The Design Patterns book contains a description of the generic Adapter pattern: "Convert the interface of a class into another interace clients expect." The ports-and-adapters pattern is a particular use of the Adapter pattern. [Alistair Cockburn][16]
{: .quote}

### Composite

Scene graphs are examples of the Composite pattern.

### Command
The inputs to our finite-state machine are commands derived at the periphery, and interpreted by the application core. 

### State
Finite state machines are an instance of the State pattern.

### Observer
The way peripheral devices and application are linked up in Pen follow the Observer pattern, or more precisely, the Publish/Subcribe pattern which is closely related to Observer.

[1]:	https://web.archive.org/web/20060711221010/http://alistair.cockburn.us:80/index.php/Hexagonal_architecture
[8]:	https://css-tricks.com/svg-path-syntax-illustrated-guide/
[9]:	https://classic.framer.com
[10]:	http://patrickbrosset.com/articles/2017-02-01-where-is-devtools-headed.html
[11]:	http://www.blackwasp.co.uk/gofpatterns.aspx
[12]:	https://web.archive.org/web/20060711221010/http://alistair.cockburn.us:80/index.php/Hexagonal_architecture
[13]:	https://web.archive.org/web/20060711221010/http://alistair.cockburn.us:80/index.php/Hexagonal_architecture
[14]:	TO%20BE%20SUPPLIED
[15]:	https://redux.js.org/faq/immutable-data#what-are-the-benefits-of-immutability
[16]:	https://web.archive.org/web/20060711221010/http://alistair.cockburn.us:80/index.php/Hexagonal_architecture

[image-1]:	/assets/images/pen/out.gif
[image-2]:	/assets/images/pen/framer.png