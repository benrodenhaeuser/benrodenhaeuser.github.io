---
title: "Understanding Sinatra"
description: "Building a toy version of a Ruby web framework from the ground up."
---

## Introduction

> We are going to develop our toy version of Sinatra in a number of iterations, starting "tiny", and building towards "small". This corresponds to how I built Frankie, too, even though this blog post makes the process perhaps appear a little more orderly than it really was. 
> While the Frankie code shown here is not lifted *verbatim* from the Sinatra code base, I do follow the Sinatra model very very closely. The aim is not to be original. To the contrary, it’s to understand Sinatra by building it from scratch. 

Here is what we will be covering: 

- Storing routes
- Handling requests
- The top-level DSL
- Parametrized routes
- Rack middleware

On every topic listed above, we will implement a more or less simplified version of core Sinatra functionality. As a result, following along with this post should be a good preparation for digging into the Sinatra code base yourself. My hope is that Frankie could be helpful to some as a launchpad into understanding Sinatra internals.

The version of Frankie linked to at the end of the post has some additional features that I will not discuss in detail in this post:

- Code organization with view templates
- Flexible return values for route blocks 
- Flexible control flow with `catch`/`throw`

Making sense of these topics should not be too difficult after reading this post.

## Hello Frankie

- At its core, Sinatra is (1) a mechanism for storing routes, and (2) a mechanism for handling requests based on the routes stored. So this is where we start.
- Sinatra makes use of the following basic division of labor: storing routes is a class-level concern, but requests are handled by a fresh instance.
- If you investigate the Sinatra source code, you will see that part (1), route storage, is a class task, while part (2), request handling, happens at the instance level. Let's first see how to store routes.

```ruby
module Frankie
  class Application
    class << self
      def routes
        @routes ||= []
      end

      def get(path, &block)
        route('GET', path, block)
      end

      def post(path, &block)
        route('POST', path, block)
      end

      def route(verb, path, block)
        routes << {
          verb:  verb,
          path:  path,
          block: block
        }
      end
    end
  end
end
```

Routes are stored in an array which we can access via the `routes` class method. Invoking the `get` and `post` method defined above leads to a route being stored. As you can see by inspecting the `route` method, a route has three components: an HTTP `verb`, a URL `path`, and a block (a Proc object, to be precise). If the `verb` for a given request is `GET`, and its `path` is `'/'`, then you can imagine that the block will determine how to handle that request.

Running the following sample code against the above class definition:

```ruby
Application.get('/') { "Frankie says hello." }
puts Application.routes
```

... you should see something similar to this:

```ruby
{
  :verb => "GET",
  :path => "/",
  :block => #<Proc:0x007faa7b03f458@frankie.rb:36>
}
```

The route is ready to be requested! But how do we handle requests? Here you go:

```ruby
module Frankie
  class Application
    def self.call(env)
      new.call(env)
    end

    def call(env)
      @request  = Rack::Request.new(env)
      @verb     = @request.request_method
      @path     = @request.path_info

      @response = {
        status:  200,
        headers: headers,
        body:    []
      }

      route!

      @response.values
    end

    def params
      @request.params
    end

    def status(code)
      @response[:status] = code
    end

    def headers
      @headers ||= { 'Content-Type' => 'text/html' }
    end

    def body(string)
      @response[:body] = [string]
    end

    def route!
      match = Application.routes
                         .select { |route| route[:verb] == @verb }
                         .find   { |route| route[:path] == @path }
      return status(404) unless match

      body match[:block].call
    end
  end
end
```

Some points of note:

- Sinatra implements the [Rack interface][1], and, of course, Frankie follows suit: our `Application` class responds to a `call` method which returns a three-element array `[status, headers, body]`. Rack does the heavy lifting of parsing the HTTP request into the `env` hash that is passed to `call`, and assembling a valid HTTP response from `call`’s return value.
- The *class* method `call` creates a new instance of `Application`, and invokes the *instance* method `call` on that instance, passing along `env`. This reflects the stateless nature of the HTTP protocol: if the class itself were to handle the request, information could easily leak across requests. 
- Our setup provides some useful defaults: unless specified otherwise, we return a `200 OK` message with content type `text/html`.  
- The `route!` method is really the heart of the matter. Given an incoming request, `route!` attempts to fetch a matching route from the `routes` array discussed earlier, and, if succesful, calls the Proc object stored for that route. The return value of that call determines the body of our HTTP response (line XX). If, on the other hand, no matching route is to be found, we send a 404 response to the client.

To see this in action, let's add our test route again, and spin up a web server. Let's add `require 'rack'` to the top of the file, and the following code to the bottom:

```ruby
Frankie::Application.get('/') { "Frankie says hello." }
Rack::Handler::WEBrick.run Frankie::Application
```

Run the code (the file is [here][2]), point your browser to `localhost:8080` (8080 is the port [set by the `Rack::Handler::WEBrick.run` method][3]), and you will be greeted by Frankie. 

Well, hello there! We got ourselves a web framework! Of course, the people behind Sinatra like to insist that Sinatra is not a framework. It stands to reason, then, that Frankie is not a framework either. Oh well.

## Frankie goes top level

Sinatra is often praised for its elegant top-level DSL. To get a Sinatra application going, all you really need to do is `require 'sinatra'` at the top of your file, and go forth writing routes like the following:

```ruby
get '/ditty' do
  status 301
  'Go look elsewhere'
end
```

This code is quite mysterious: first, the `get` method is available at the top level of our program. How so? Second, the `status` method – which sets the status code of our HTTP response – is available within the route block. Why is that?

The answer is that (1) Sinatra delegates certain method calls – like `get` invocations, for instance – from the top level to the `Application` class, and (2) the block that is passed with the `get` invocation will eventually be evaluated in the context of the instance handling the request (rather than in the context provided by top-level `main`).

Now Frankie should certainly be able to do that, too! Let's deal with the two aspects in turn. First, to be able to delegate top level method calls, we add another module to `Frankie`:

```ruby
module Frankie
  module Delegator
    def self.delegate(method_name)
      define_method(method_name) do |*args, &block|
        Application.send(method_name, *args, &block)
      end
    end

    delegate(:get)
    delegate(:post)
  end
end

extend Frankie::Delegator
```

This code passes on any `get` and `post` invocations received by `main` to the application object, which is of course exactly what we want. Take note that the last line of the snippet reads `extend` rather than `include`. If we had used `include`, the newly defined methods would be added to `Object`. `extend` merely attaches them to `main`. 

This takes care of our first issue: we can now freely invoke `get` from the top level, without having to prefix our routes with `Frankie::Application`. Nice!

Now what about method invocations *within* the route block (remember the call to `status` from the sample route above)? The answer is, again, meta-programming, and more in particular: `instance_eval`. The documentation for this method (which belongs to `BasicObject` and is thus available to any Ruby obect) says that `instance_eval` "evaluates a string containing Ruby source code, or the given block, within the context of the receiver." Now this is of course precisely what we need, since we want our route block to be evaluated in the context of the instance handling the current request.

To put `instance_eval` to use, all we really need to change is one line of code – the last line of our `route!` method:

```ruby
module Frankie
  class Application
	def route!
	  match = Application.routes
	                     .select { |route| route[:verb] == @verb }
	                     .find   { |route| route[:path] == @path }
	  return status(404) unless match
	
	  body instance_eval(&match[:block])
	end
  end
end
```

Recall that `match[:block]` is a Proc object. We convert it to a block `&match[:block]`, and pass it into `instance_eval`. Since this method call is issued by the `Frankie::Application` instance, `Frankie::Application` provides the context in which the block is evaluated. In particular, all the instance methods of `Frankie::Application` are available within the block. 

Run [this file][4] (our code so far), head to `localhost:8080/ditty`, and you will see that our sample request from above is handled correctly: we get back a 301, and are told to "go look elsewhere". Fair enough.

*Aside:* While early versions of Sinatra used to make use of `instance_eval`, later versions (including the current one) employ a different mechanism that is more sophisticated as well as slightly more involved. It involves generating unbound method objects that are dynamically bound to the current instance, and has several advantages that are beyond the scope of this post. 

## Frankie recognizes patterns

What is sorely missing from Frankie so far is the ability to *parametrize routes*:

```ruby
get '/albums/:album/song/:song' do
  "My favourite song is '#{params['song']}' from '#{params['album']}'."
end
```

Here is what we want to be able to do. Suppose a user sends a request with the path

> `/albums/greatest-hits/songs/my-way`

We would like to match this path against a regular expression (generated by Frankie as our route is processed) that produces the captures `greatest-hits` and `my-way`. These should be linked with the route parameters to form a hash 

```ruby
{ 'album' => 'greatest-hits', 'song' => 'my-way' }
```

which should be merged into the `params` hash (which is stored as part of the Rack `@request` object). The `params` hash, in turn, needs to be available to the instance handling the request, so it should be the return value of an instance method `params`.  As we saw above, route blocks are evaluated in the context of the current instance, so if the current instance has access to an instance method, then we can call it from a route block.

Starting at the end, we implement the `params` method first: 

```ruby
module Frankie
  class Application
    def params
      @request.params
    end
  end 
end
```

Remember that `@request` is an instance of `Rack::Request`. 

Next, let’s adapt our mechanism for storing routes to enable the handling of parametrized routes. This needs to happen at the *class level*:

```ruby
module Frankie  
  class Application
    class << self
      def route(verb, path, block)
        pattern, keys = compile(path)

        routes << {
          verb:     verb,
          pattern:  pattern,
          keys:     keys,
          block:    block
        }
      end

      def compile(path)
        segments = path.split('/', -1)
        keys = []

        segments.map! do |segment|
          if segment.start_with?(':')
            keys << segment[1..-1]
            "([^\/]+)"
          else
            segment
          end
        end

        pattern = Regexp.compile("\\A#{segments.join('/')}\\z")
        [pattern, keys]
      end
    end
  end
end
```

Instead of simply storing a request path, we compile a given path (possible containing parameters) into a `pattern` (a regular expression) and a set of `keys` (i.e., strings). The keys will eventually become hash keys in our `params` hash. 

For the above example route, the `[pattern, keys]` array returned by the `compile` class method looks as follows: 

```ruby
[/\A\/albums\/([^\/]+)\/songs\/([^\/]+)\z/, ["album", "song"]]
```

Within the regex, `([^\/]+)` matches sequences of characters that do not contain forward slashes. 

Now on the *instance level*, we exploit the information stored in `pattern` and `keys`:

```ruby
module Frankie
  class Application
    def route!
      match = Application.routes
                         .select { |route| route[:verb] == @verb }
                         .find { |route| route[:pattern].match(@path) }
      return status(404) unless match

      values = match[:pattern].match(@path).captures
      params.merge!(match[:keys].zip(values).to_h)
      body instance_eval(&match[:block])
    end
  end
end
```

We find a stored pattern that matches (in the regex sense of „match“) the requested path, extract the captured groups (Ruby makes this really easy), and populate our `params` hash with the retrieved key-value pairs. For our example route,  the `values` array will be `['greatest-hits', 'my-way']`, and zipping our stored keys with these values produces the hash

```ruby
{ 'album' => 'greatest-hits', 'song' => 'my-way' }
```
 
which we merge into `params`. Done! Try it out using [this file][5], if you like, requesting your favourite song from your favourite album.

*Aside:* Sinatra itself goes to considerable length to allow users flexibility in making use of route parameters – we have only scratched the surface here. Also, as of Sinatra 2.0, a dedicated gem is used for pattern matching, the [Mustermann library][6]. Again, this additional level of sophistication is beyond the scope of this post.

## Frankie likes cookies

Sinatra applications are Rack applications, so they place nice with Rack middleware. If you have a piece of middleware, all you need to do is place a `use` statement close to the top of your Sinatra application file, such as:

```ruby
use MyMiddleware 
```

In this section, we will implement this functionality in Frankie, using cookie-based session management as provided by `Rack::Session::Cookie` as an example (which is also what Sinatra uses by default).

First, let’s look at how to set up the middleware chain. The overall app encompassing all middleware nodes (and our application instance) is stored in an instance variable `@prototype` (the choice of name will become clear in a minute). Setting up the `@protoype` object makes heavy use of the functionality already provided by Rack: 

```ruby
class Application
  class << self
	def prototype
	  @prototype ||= new
    end

    alias new! new

    def new
      instance = new!
      build(instance).to_app
    end

    def build(app)
      builder = Rack::Builder.new

      if @middleware
        @middleware.each do |middleware, args|
          builder.use(middleware, *args)
        end
      end

      builder.run app
      builder
    end

    def use(middleware, *args)
      (@middleware ||= []) << [middleware, args]
    end
  end
end
```

The gist is this: every `use` statement in our code adds a middleware node to the `@middleware` array. As a `@prototype` object is created, all nodes are „wired up“, with our `Frankie::Application` instance being the last node in the chain (the node „fronting“ the chain).  As a result, we got ourselves a Rack app accessible via the `prototype` method.

Now how to handle an incoming request given this setting? There *is* a conceptual conundrum to solve. Our earlier code used to create a fresh application instance for every request that needs to be handled. However, once the middleware chain is set up as above, a single application instance will survive across requests. The solution is to use this instance as a blueprint which is duplicated with every request. Handling a request then involves roughly the following steps: 

- The class method `call` is invoked on `Frankie::Application`. 
- The body of that method invokes `call` on the `@prototype` object, which is a Rack app that contains all middleware nodes and is fronted by a `Frankie::Application` instance. 
- If that `@prototype` object does not exist already, create it on the fly.  
- Walk through the middleware chain invoking `call` on each node. Our `Frankie::Application` instance is the last node in the chain.
- As this last node is `call`ed, the instance *duplicates itself*, and lets the duplicated instance handle the request.
- In this way, the instance fronting the middleware chain persists across requests, but never actually handles a request itself. 

In code, this looks like as follows: 

```ruby
class Application
  class << self
    def call(env)
      prototype.call(env)
    end
  end

  def call(env)
    dup.call!(env)
  end

  def call!(env)
    # routing code that used to live in `call` goes here
  end
end
```

Now return to our use case of cookie-based session management. We add a `session` method for accessing the session object. This simply wraps the session object provided by Rack:

```ruby
module 
  class Application
    def session
      @request.session
    end
  end
end
```

All that we need to do as a Frankie user is to add the earlier-mentioned use statement to our app:

```ruby
use Rack::Session::Cookie
```

(TODO: The Test)

## There’s More

- The code on github includes:
	- *View templates* (The same mechanism is also responsible for the fact that instance variables – but not local variables – declared in route blocks are available to template files. They end up becoming part of the state of the `Application` instance, which is also the context in which templates are parsed. I won’t discuss templates further in this post, but it is not difficult to add them to Frankie, and the version.)
	- *Throw/catch*
	- *Flexible return values*
- There is also a simple sample Frankie application. 

[1]:	https://rack.github.io
[2]:	https://github.com/benrodenhaeuser/frankie/blob/master/iterations/01_hello_frankie/frankie.rb
[3]:	https://github.com/rack/rack/blob/42e48013dd1b6dbda990dfa3851856c199b0b1f9/lib/rack/handler/webrick.rb#L32
[4]:	https://github.com/benrodenhaeuser/frankie/blob/master/iterations/02_frankie_goes_top_level/frankie.rb
[5]:	https://github.com/benrodenhaeuser/frankie/blob/master/iterations/03_frankie_recognizes_patterns/frankie.rb
[6]:	https://github.com/sinatra/mustermann