---
title: Frankie
case-study: true
description: Building a toy version of a Ruby web framework from scratch.
abstract: "Building a toy version of the \"Sinatra\" web framework from the ground up: handling requests, the top-level DSL, parametrized routes and Rack middleware."
date: 2018-06-01
header-image: /assets/images/frankie/frankie.jpg
image-caption: A young Frank Sinatra surrounded by admirers.
external-links:
  github: https://github.com/benrodenhaeuser/frankie
---

> * TOC
> {:toc}
{: .toc}

## Introduction

This project grew out of my own attempt to understand the inner workings of [Sinatra][1], a popular Ruby tool for quickly building web applications. The Sinatra code base is comparatively compact, but dense. I found it quite challenging to read initially. My hope is that this case study could be of help for people who would like to get a better understanding of Sinatra internals, just as I did when I started diving into its source code.

Rather than commenting on selected parts of the Sinatra source, I will discuss „Frankie“, a toy version of Sinatra I built to aid my own learning process. When I say „toy version of Sinatra“, I really mean four things: Frankie …

1. is fully functional,
2. is not meant for real-world use,
3. follows the way Sinatra does things very closely, and
4. implements a *selection* of the Sinatra feature set only.

In this post, we start even smaller: our initial version of Frankie will only consist of a couple dozen lines of code, and won’t be very capable at all. Subsequent iterations will extend and refine this base setting. We will cover storing routes and handling requests, Sinatra’s top-level DSL, route parameters and rack middleware.

In addition, Frankie has some additional Sinatra-derived features that I will not discuss in detail here:

- Separating logic from presentation with view templates
- Flexible return values for route blocks
- Flexible control flow using `throw`/`catch`

My criterion for what features to include in Frankie was simple: I wrote a [basic Sinatra sample app][2] (for maintaining a list of quotes by famous people), and then figured out what it takes to run this app while replacing `require 'sinatra'` with `require 'frankie'`.

The overall result is a tiny code base that – hopefully – give a pretty good impression of the way Sinatra works, and which should – hopefully – be a lot easier to find your way around than [`sinatra/base.rb`][3], which has slightly less than 2000 lines of code.

> Besides following this post, another approach would be to jump right into the Frankie source code [on Github][4], and use that as a launchpad for a subsequent exploration of the Sinatra codebase itself.
{: .aside}

## 01. Hello Frankie: Storing Routes and Handling Requests

The people behind Sinatra like to emphasize that Sinatra is not a framework, but rather a tool for „solving HTTP“, a „DSL for quickly creating web applications in Ruby with minimal effort“.

While I will continue to use the term „framework“ (for lack of a better word, not to make some kind of point), the idea of „solving HTTP“ provides as good a starting point as any for our exploration. The most basic aspect of this is arguably the capability to set up route controllers that handle incoming HTTP requests. Sinatra sets up a basic division of labour in this regard: while routes are stored on the class level, requests are handled on the level of the instance.

To get started with our Frankie toy framework, let's first see how to store routes.

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

It’s quite straightforward, really: a class instance variable `@routes` (accessible via the class method `Frankie::Application.routes`) is maintained that holds an array of routes. In our implementation, each route is a hash with three keys, `:verb`, `:path`, and `:block`. Requests will be matched against this array of route.

Running the following sample code against the above class definition:

```ruby
Frankie::Application.get('/') { "Frankie says hello." }
puts Frankie::Application.routes
```

... you should see something similar to this:

```ruby
{
  :verb => "GET",
  :path => "/",
  :block => #<Proc:0x007faa7b03f458@frankie.rb:36>
}
```

That’s all there is to it at this point: a route, ready to be requested. If the `:verb` for a given request is `GET`, and its `:path` is `'/'`, then you can imagine that the value for  the `:block` key (a `Proc` object) holds the code that will determine how to handle that request. Let’s implement this idea.

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

First, have a look at the class method `Frankie::Application.call`. Sinatra implements the [Rack interface][5], and, of course, Frankie follows suit. This means (1) that  `Frankie::Application` responds to `call` in the first place, and  (2) that the class method `call` returns a three-element array `[status, headers, body]`. Rack does the heavy lifting of parsing the HTTP request into the `env` hash that is passed to `call`, and assembling a valid HTTP response from `call`’s return value.

In the above code, the *class* method `call` creates a new instance of `Frankie::Application`, and invokes the *instance* method `call` on that new instance, passing along `env`. Instance level `call` will do the work, and its return value will determine the return value of class level `call`.

The idea of generating a new instance for every request reflects the stateless nature of the HTTP protocol: if the class itself were to handle the request, information could easily leak across requests. It also puts the division of labour mentioned above into practice: handling the request is an instance-level responsibility, so the class simply forwards the `call` to such an instance.

The `route!` method (an instance method, not to be confused with the earlier class method `route`) which is invoked from the instance method `call` is really the heart of the matter. Given an incoming request, `route!` attempts to fetch a matching route from the `routes` array maintained by the class. If successful, the Proc object stored for that route is called. The return value of that call determines the body of our HTTP response. If, on the other hand, no matching route is found, we send a 404 response to the client.

To see this in action, let's add `require 'rack'` to the top of the file, and the following code to the bottom:

```ruby
Frankie::Application.get('/') { "Frankie says hello." }
Rack::Handler::WEBrick.run Frankie::Application
```

Run the code (the file is [here][6]), point your browser to `localhost:8080` (8080 is the port [set by the `Rack::Handler::WEBrick.run` method][7]), and you will be greeted by Frankie.

So we got ourselves the beginnings of a web framework, or the beginnings of a „tool for solving HTTP“, if you prefer. But, of course, we are just getting started.

## 02. Frankie Reaches for the Stars: The Top-Level DSL

Let’s turn to some aspects of the top-level DSL for which Sinatra is often praised. To get a Sinatra application going, all you really need to do is `require 'sinatra'` at the top of your file, and go forth writing routes like the following:

```ruby
get '/ditty' do
  status 301
  'Moved permanently.'
end
```

While it’s obvious for a Rubyist that what we see here is actually a method invocation, the code may still quite mysterious. First, the `get` method is available at the top level of our program. How so? Second, the `status` method – which sets the status code of our HTTP response – is in scope within the route block. Why is that? You may remember methods with these names from the previous section of this post. Still, the question remains why they would be available here in the `main` scope.

The answers to the two questions go something like this: As for (1), Sinatra *delegates* certain method calls – like `get` invocations, for instance – from the top level to the `Application` class. And as for (2), the block that is passed with the `get` invocation will eventually be evaluated *in the context of the instance* handling the request, rather than in the context provided by top-level `main`.

Let's  see how to implement this in Frankie, our toy version of Sinatra. First, to be able to delegate top level method calls, we add a `Delegator` module to `Frankie`:

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

As a result of this code, any `get` and `post` invocations received by `main` will be passed on  to the `Application` object. Take note that the last line of the snippet lives at the top level. Also, it reads `extend` rather than `include`. If we had used `include` instead, the newly defined methods would be added to `Object`. But `extend` merely attaches them to `main`. Overall, this code takes care of our first issue: we can now freely invoke `get` (and `post`) from the top level, without having to prefix our route handlers with `Frankie::Application`.

Now what about method invocations *within* the route block, our second point above? The answer is, again, meta-programming, and more in particular: `instance_eval`. The [documentation for this method][8] (which belongs to `BasicObject` and is thus available to any Ruby object) tells us that `instance_eval` "evaluates (…) the given block (…) within the context of the receiver." Now this is of course precisely what we need, since we want our route block to be evaluated in the context of the instance handling the current request.

> While early versions of Sinatra made use of `instance_eval` in the way described in this post, later versions (including the current one) employ a different and slightly more involved mechanism for the same purpose. It involves generating method objects from given route blocks that are dynamically bound to the current instance as a request is processed. One advantage of this is that route blocks with parameters become possible. For details, consult [the Sinatra source][9].
{: .aside}

To put `instance_eval` to use, all we really need to change is one line of code – the last line of our `route!` method:

```ruby
module Frankie
  class Application
	def route!
	  match = Application.routes
	                     .select { |r| r[:verb] == @verb }
	                     .find   { |r| r[:path] == @path }
	  return status(404) unless match

	  body instance_eval(&match[:block])
	end
  end
end
```

Recall that `match[:block]` is a Proc object. We convert this object to a block `&match[:block]`, and pass it into `instance_eval`. Since the receiver of the `instance_eval` message is our `Frankie::Application` instance, this instance provides the context in which the block is evaluated. So in particular, all the instance methods of `Frankie::Application` are available to the block at evaluation time.

Summing up, two main ingredients enable top-level route controllers: delegated method calls, and route blocks that are scoped to the current application instance as a request is handled. Run [this file][10] (our code so far), head to `localhost:8080/ditty`, and you will see that our sample request from above works: we get back a 301, indicating that the requested resource has been moved.

## 03. Frankie Sees a Pattern: Route Parameters

Next, let’s make Frankie a bit more capable. What is sorely missing from our toy version of Sinatra so far is the ability to *parametrize routes*. Here, is the kind of code we would like to be able to write:

```ruby
get '/albums/:album/songs/:song' do
  "Next up: '#{params['song']}' from '#{params['album']}'."
end
```

Given this route, suppose a user sends a request with the path

> `/albums/greatest-hits/songs/my-way`

In this example, `'greatest-hits'` and `'my-way` are essentially arguments that fill in the slots provided by the parameters `:album` and `:song`. As the route block shows, the mappings from parameters to arguments supplied by the user making the request should be available as key-value pairs within a `params` hash, for „Frankie developers“ to freely make use of.

Here is an idea how to make this work: Let’s match the request path against a regular expression stored along with the route in `Frankie::Application`. In our example, we expect the matching to produce regex captures `greatest-hits` and `my-way`. These should be linked with the route parameters to form a hash

```ruby
{ 'album' => 'greatest-hits', 'song' => 'my-way' }
```

which should then be merged into a `params` hash. The `params` hash, in turn, needs to be available to the instance handling the request, so it should be the return value of an instance method `params`.  As we saw above, route blocks are evaluated in the context of the current instance, so if the current instance has access to an instance method, then we can call it from a route block.

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

Remember that `@request` is an instance of `Rack::Request`. Conveniently, `@request.params` is a hash we can use for our purposes.

Next, let’s adapt our mechanism for *storing* routes with parameters. Keeping in mind what was said in the first section of this post, this needs to happen at the *class level*. The method we need to change is the class method `route`.

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

This new version of the `route` method compiles a given path (possible containing parameters) into a `pattern` (a regular expression) and an array of strings called `keys`. During request handling, those strings will eventually become keys in the `params` hash.

For the above example route, the `[pattern, keys]` array returned by the `compile` method looks as follows:

```ruby
[/\A\/albums\/([^\/]+)\/songs\/([^\/]+)\z/, ["album", "song"]]
```

Within the regex, `([^\/]+)` captures sequences of characters that do not contain forward slashes – these will be the arguments that fill in the slots provided by our route parameters.

Now on the *instance level*, we exploit the information stored in `pattern` and `keys` as follows:

```ruby
module Frankie
  class Application
    def route!
      match = Application.routes
                         .select { |r| r[:verb] == @verb }
                         .find   { |r| r[:pattern].match(@path) }
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

which we merge into `params`. Done!

> Sinatra goes out of its way to allow users flexibility in making use of route parameters. In addition to strings, regular expressions are allowed as route paths, and route paths may contain wildcards („splats“) and/or optional parameters. So we have merely scratched the surface here. Also, the way Sinatra stores and processes parametrized routes has changed somewhat with the advent of the [Mustermann string processing library][11] in Sinatra 2.0. Our approach here is closer to how things used to work up to Sinatra 1.4.x.
{: .aside}

Try it out using [this file][12] (which contains the Frankie code as of the end of this section), requesting your favorite song from your favorite album.

## 04. Frankie Likes Cookies: Rack Middleware

In this final section, we turn to Sinatra’s take on Rack middleware, and briefly discuss those aspects of Frankie that are *not* covered in detail here.

The concept of Rack middleware grows naturally out of the concept of a Rack application. As described in [part 01][13], a Rack application is an object that responds to `call` and returns a three-element array of the appropriate kind. Now nothing prevents a Rack app from sending a `call` message to *another* Rack app, and using the return value of that `call` to determine its own return value. If a number of Rack apps are hooked up in this way, each calling the next, the non-terminal nodes in this configuration are *middleware* (think of the middleware chain as a linked list of Rack apps and you are not far off from the truth). We can then wrap the whole chain in *another* object that responds to `call` (and returns an appropriate array) and provides an entry point to the whole middleware chain.

The purpose of setting up such a chain (or "pipeline") of processing steps is to cleanly separate the various tasks that arise during a request-response cycle – which besides the actual request handling (which is the responsibility of your route controllers) may include authentication, logging, session management and a host of other things (see [this][14] Stack Overflow answer for an excellent explanation and further pointers).

Sinatra applications are Rack applications, so of course they place nice with Rack middleware. If you have a number of middleware nodes you want to make use of, all you need to do is place corresponding `use` statements close to the top of your Sinatra application file, such as:

```ruby
use MyMiddleware1
use MyMiddleware2
...
```

Sinatra will hook up the nodes in such way that, as a new request comes in, a `MyMiddleware1` instance will be the first node to receive a `call` message, and an instance of `Sinatra::Application` will be the last (the Sinatra app *fronts* the middleware chain), with each but the last node `call`ing the next node in turn. This is simply the way Rack does it, and Sinatra sticks to the protocol.

In this section, we will implement the same functionality in Frankie, using cookie-based session management as provided by `Rack::Session::Cookie` as an example for a commonly used piece of middleware we can simply take off the shelf. As we will see, the presence of middleware will necessitate a more sophisticated way of handling the division of labour between class and instance that we first talked about in section 01.

> `Rack::Session::Cookie`  is also the default session management solution used by Sinatra. However, Sinatra goes one step further and makes sessions a setting, so beside `use Rack:Session::Cookies`, you can also simply do `enable :sessions`.
{: .aside}

First, let’s look at how to set up the middleware chain. The entry point to the middleware chain is stored in an instance variable `@prototype` (the choice of name will become clear in a minute). Setting up the `@protoype` object makes use of the middleware-handling capabilities already provided by Rack:

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

The gist is this: every `use` statement in our code adds a middleware node to the `@middleware` array (for this to work, we need to *delegate* `use` statements from `main` to `Frankie::Application`, as described in [part 01][15]). As a `@prototype` object is newly created (making use of the `Rack::Builder` class), all those nodes are „wired up“, with a `Frankie::Application` instance fronting the middleware chain. Note that the `@prototype` object is created only once and stored in the `@prototype` class instance variable. The next time around, `prototype` will return the value of that variable, rather than setting up the middleware chain again.

While this is clearly the right approach, it points to a problem for our earlier way of creating a new instance of `Frankie::Application` on every incoming request. Namely, once the middleware chain is set up as above, a specific instance of `Frankie::Application` will persistently front the middleware chain, i.e., it will survive across requests. After all, it’s stored as part of the middleware configuration in the `prototype` object. The question then is how to reinstate the „one instance per request“ principle in this context.

Sinatra’s, and accordingly, Frankie’s, solution is to use the stored instance as a blueprint which is duplicated with every request (hence the choice of the name „`prototype`“). So we add the following code:

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

As the `Frankie::Application` *class* receives a `call` from the web server, it passes the `call` to the `prototype` object. This results in the middleware nodes being `call`ed in turn, until finally, the `Frankie::Application` instance fronting the chain is `call`ed. At this point, the instance *duplicates itself* and invokes `call!` on the duplicate. The actual route-handling code that used to live in `Frankie::Application#call` is simply moved to `call!`. Overall, this is really elegant, and it’s just how Sinatra does it.  

As promised, setting up middleware is really easy now. For illustration, return to our use case of cookie-based session management. Let’s first add a `session` method for accessing the session object. It simply wraps the session object provided by Rack:

```ruby
module
  class Application
    def session
      @request.session
    end
  end
end
```

Now all we really need to do as a Frankie user is to add the earlier-mentioned use statement to our app:

```ruby
use Rack::Session::Cookie, :key => 'rack.session', :secret => "secret"
```

To verify that our session management works, we send ourselves a message across requests:

```ruby
get '/set_message' do
  session[:message] = "Hello, there."
  "Message has been set."
end

get '/get_message' do
  if session[:message]
	"Your message: " + session.delete(:message)
  else
	"There is no message."
  end
end
```

Use [this file][16] (which provides a snapshot of the state of Frankie after these four posts) to see for yourself, if you like. So now we have a version of Frankie that can handle cookies, as well as other pieces of middleware that may come in handy. Neat!

This completes our small tour of Sinatra functionality rebuilt from scratch. See the box below for pointers to some additional features that I have not discussed in detail. You might also want to check out the Frankie sample app mentioned in [part 01][17] (to run it, `cd` into the `examples/quotes` directory, followed by `ruby app.rb`), if only to conclude that it really does look like a Sinatra app. You can find all the material in the Frankie repo [on Github][18].

> ### There’s More
> {: .no_toc}
> As mentioned earlier, there is more to Frankie than I could cover in this case study. Here is a quick overview of what Sinatra-inspired features you will find in the [complete Frankie source][19] beyond what we discussed here:
> - View templates: to better organize your code, separate presentation from application logic with view templates. The bindings of the application instance are passed into the template so that instance variables remain useable. An additional [`Templates` module][20] does the job.
> - Throw/catch: Sinatra makes quite heavy use of the `throw`/`catch` mechanism when handling requests. This is what makes Sinatra’s `halt` possible, praised in [this post][21]. To see how this is implemented in Frankie, start at the  `invoke { dispatch! }` method call [here][22].
> - Flexible return values: Frankie allows return values of route blocks to be strings (that end up as the response body), numbers (status codes) or Rack-compliant arrays. The code that allows for this flexibility is [part of the `invoke` method][23].
> - Launching your application: the way Sinatra is set up, you simply `require 'sinatra'` at the top of an `app.rb` file, write your routes, and launch the app with `ruby app.rb` (at least if you code in the so-called „classical style“). To make this possible, Sinatra uses the [`at_exit` trick][24], and so does Frankie.
{: .aside}

[1]:	http://sinatrarb.com
[2]:	https://github.com/benrodenhaeuser/frankie/blob/master/examples/quotes/app.rb
[3]:	https://github.com/sinatra/sinatra/blob/master/lib/sinatra/base.rb
[4]:	https://github.com/benrodenhaeuser/frankie
[5]:	https://rack.github.io
[6]:	https://github.com/benrodenhaeuser/frankie/blob/master/blog/01_hello_frankie/frankie.rb
[7]:	https://github.com/rack/rack/blob/42e48013dd1b6dbda990dfa3851856c199b0b1f9/lib/rack/handler/webrick.rb#L32
[8]:	http://ruby-doc.org/core-2.4.1/BasicObject.html#method-i-instance_eval
[9]:	https://github.com/sinatra/sinatra/blob/a1e36db87e9d6bc3a2d8721078da18e704ee8ba3/lib/sinatra/base.rb#L1614
[10]:	https://github.com/benrodenhaeuser/frankie/blob/master/blog/02_frankie_reaches_for_the_top/frankie.rb
[11]:	https://github.com/sinatra/mustermann
[12]:	https://github.com/benrodenhaeuser/frankie/blob/master/blog/03_frankie_sees_a_pattern/frankie.rb
[13]:	/2018/06/01/sinatra-from-scratch/
[14]:	https://stackoverflow.com/a/2257031/2744529
[15]:	/2018/06/01/sinatra-from-scratch/
[16]:	https://github.com/benrodenhaeuser/frankie/blob/master/blog/04_frankie_likes_cookies/frankie.rb
[17]:	/2018/06/01/sinatra-from-scratch/
[18]:	https://github.com/benrodenhaeuser/frankie
[19]:	https://github.com/benrodenhaeuser/frankie/blob/master/frankie.rb
[20]:	https://github.com/benrodenhaeuser/frankie/blob/459a2a2997b8fd96d2af5617665eed53cbe7a4a6/frankie.rb#L4
[21]:	http://myronmars.to/n/dev-blog/2012/01/why-sinatras-halt-is-awesome
[22]:	https://github.com/benrodenhaeuser/frankie/blob/459a2a2997b8fd96d2af5617665eed53cbe7a4a6/frankie.rb#L114
[23]:	https://github.com/benrodenhaeuser/frankie/blob/459a2a2997b8fd96d2af5617665eed53cbe7a4a6/frankie.rb#L139
[24]:	https://blog.arkency.com/2013/06/are-we-abusing-at-exit/