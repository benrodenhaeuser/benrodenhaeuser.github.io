---
title: "Understanding Sinatra"
description: "Hello Frankie: building a toy version of a Ruby web framework from the ground up."
date: 2018-06-01
---

This series of posts grew out of my own attempt to understand the inner workings of Sinatra, a popular Ruby tool for quickly building web applications. The Sinatra code base is comparatively compact, but dense. I found it quite challenging to read initially. My hope is that this series could provide a launchpad for people who would like to get a better understanding of Sinatra internals, just as I did when I started diving into its source code.

The presentation of „Frankie“, my toy version of Sinatra, is in iterations, with subsequent entries in the series extending the base setting introduced in this post. Here is what we will be covering:

- Storing routes and handling requests (this post)
- The top-level DSL ([part 02][1] of the series)
- Parametrized routes ([part 03][2])
- Rack middleware ([part 04][3])

On every topic listed above, we will implement a pared down version of core Sinatra functionality. While the code shown here is not literally lifted from the Sinatra code base, I do follow the Sinatra model very very closely. The aim is not to be original, to the contrary, it’s to understand Sinatra by implementing a selection of its ideas and features from scratch.

Beyond what is discussed in these posts, Frankie has some additional Sinatra-derived features that I will not discuss in detail:

- Separating logic from presentation with view templates
- Flexible return values for route blocks
- Flexible control flow using `throw`/`catch`

If you are interested in those features, have a look at the Frankie source code [on Github][4].

## Hello Frankie

The people behind Sinatra like to emphasize that Sinatra is not a framework, but rather a tool for „solving HTTP“, a „DSL for quickly creating web applications in Ruby with minimal effort“.

While I will continue to use the term „framework“ for lack of a better word, the idea of „solving HTTP“ provides as good a starting point as any for our exploration.  The most basic aspect of this is arguably the capability to set up route controlers capable of generating appropriate responses to incoming HTTP requests. Sinatra sets up a basic division of labour in this regard: routes are stored on the class level, while requests are handled on the instance level.

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

It’s quite straightforward, really: a class instance variable `@routes` (accessible via the class method `Frankie::Application.routes`) is maintained that holds an array of routes. In our implementation, each route is a hash with three keys, `:verb`, `:path`, and `:block`. If the `:verb` for a given request is `GET`, and its `:path` is `'/'`, then you can imagine that the value for  the `:block` key holds the code that will determine how to handle that request.  

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

That’s all there is to it at this point: a route, ready to be requested, with the idea, to reiterate, that as a `GET` request for `/` comes in, the stored block (which is really a Proc object) should be executed. Let’s implement this idea.

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

First, have a look at `Frankie::Application.call`. Sinatra implements the [Rack interface][5], and, of course, Frankie follows suit. This means (1) that  `Frankie::Application` responds to `call` in the first place, and  (2) that the class method `call` returns a three-element array `[status, headers, body]`. Rack does the heavy lifting of parsing the HTTP request into the `env` hash that is passed to `call`, and assembling a valid HTTP response from `call`’s return value.

In the above code, the *class* method `call` creates a new instance of `Frankie::Application`, and invokes the *instance* method `call` on that new instance, passing along `env`. This reflects the stateless nature of the HTTP protocol: if the class itself were to handle the request, information could easily leak across requests. It also puts the division of labour mentioned above into practice: handling the request is an instance-level responsibility, so the class simply forwards the `call` to such an instance.

The `route!` method (an instance method, not to be confused with the earlier class method `route`) which is invoked from the instance method`call` is really the heart of the matter. Given an incoming request, `route!` attempts to fetch a matching route from the `routes` array maintained by the class. If successful, the Proc object stored for that route is called. The return value of that call determines the body of our HTTP response. If, on the other hand, no matching route is to be found, we send a 404 response to the client.

To see this in action, let's add `require 'rack'` to the top of the file, and the following code to the bottom:

```ruby
Frankie::Application.get('/') { "Frankie says hello." }
Rack::Handler::WEBrick.run Frankie::Application
```

Run the code (the file is [here][6]), point your browser to `localhost:8080` (8080 is the port [set by the `Rack::Handler::WEBrick.run` method][7]), and you will be greeted by Frankie.

So we got ourselves the beginnings of a web framework – or the beginnings of a „tool for solving HTTP“, if you prefer. Not so bad for a couple dozen lines of code. But, of course, we are just getting started. In [part 02 of the series][8], we will have a look at one of the signature features of Sinatra: it’s elegant top level DSL.

[1]:	/2018/06/02/frankie-goes-top-level/
[2]:	/2018/06/03/frankie-recognizes-patterns/
[3]:	/2018/06/04/frankie-likes-cookies/
[4]:	https://github.com/benrodenhaeuser/frankie
[5]:	https://rack.github.io
[6]:	https://github.com/benrodenhaeuser/frankie/blob/master/iterations/01_hello_frankie/frankie.rb
[7]:	https://github.com/rack/rack/blob/42e48013dd1b6dbda990dfa3851856c199b0b1f9/lib/rack/handler/webrick.rb#L32
[8]:	/2018/06/02/frankie-goes-top-level/