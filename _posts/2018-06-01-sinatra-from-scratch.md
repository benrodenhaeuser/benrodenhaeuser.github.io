---
title: "Sinatra From Scratch"
description: "Building a toy version of a Ruby web framework from the ground up."
date: 2018-06-01
---

This series of posts grew out of my own attempt to understand the inner workings of [Sinatra][1], a popular Ruby tool for quickly building web applications. The Sinatra code base is comparatively compact, but dense. I found it quite challenging to read initially. My hope is that this series could be of help for people who would like to get a better understanding of Sinatra internals, just as I did when I started diving into its source code.

Rather than commenting on selected parts of the Sinatra source, I will discuss „Frankie“, a toy version of Sinatra I built to aid my own learning process. When I say „toy version of Sinatra“, I really mean four things: Frankie …

1. is fully functional,
2. is not meant for real-world use,
3. follows the way Sinatra does things very closely, and
4. implements a *selection* of the Sinatra feature set only.

In this post, we start even smaller: our initial version of Frankie will only consist of a couple dozen lines of code, and won’t be very capable at all. Subsequent iterations will extend and refine this base setting. Here is what we will be covering:

- Storing routes and handling requests (this post)
- The top-level DSL ([part 02][2] of the series)
- Route parameters ([part 03][3])
- Rack middleware ([part 04][4])

On every topic listed above, I will discuss how to implement a pared down version of core Sinatra functionality. Beyond these posts, Frankie has some additional Sinatra-derived features that I will not discuss in detail (but see [part 04][5] for some comments):

- Separating logic from presentation with view templates
- Flexible return values for route blocks
- Flexible control flow using `throw`/`catch`

My criterion for what features to include in Frankie was simple: I wrote a [basic Sinatra sample app][6] (for maintaining a list of quotes by famous people), and then figured out what it takes to run this app while replacing `require 'sinatra'` with `require 'frankie'`.

The overall result is around 200 lines of code that – hopefully – give a pretty good impression of the way Sinatra works, and which should – hopefully – be a lot easier to find your way around than [`sinatra/base.rb`][7], which has slightly less than 2000 lines of code.

> Besides following this series of posts, another approach would be to jump right into the Frankie source code [on Github][8], and use that as a launchpad for a subsequent exploration of the Sinatra codebase itself.
{: .aside}

## Hello Frankie

The people behind Sinatra like to emphasize that Sinatra is not a framework, but rather a tool for „solving HTTP“, a „DSL for quickly creating web applications in Ruby with minimal effort“.

While I will continue to use the term „framework“ (for lack of a better word, not to make some kind of point), the idea of „solving HTTP“ provides as good a starting point as any for our exploration. The most basic aspect of this is arguably the capability to set up route controlers that handle incoming HTTP requests. Sinatra sets up a basic division of labour in this regard: while routes are stored on the class level, requests are handled on the level of the instance.

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

First, have a look at the class method `Frankie::Application.call`. Sinatra implements the [Rack interface][9], and, of course, Frankie follows suit. This means (1) that  `Frankie::Application` responds to `call` in the first place, and  (2) that the class method `call` returns a three-element array `[status, headers, body]`. Rack does the heavy lifting of parsing the HTTP request into the `env` hash that is passed to `call`, and assembling a valid HTTP response from `call`’s return value.

In the above code, the *class* method `call` creates a new instance of `Frankie::Application`, and invokes the *instance* method `call` on that new instance, passing along `env`. Instance level `call` will do the work, and its return value will determine the return value of class level `call`.

The idea of generating a new instance for every request reflects the stateless nature of the HTTP protocol: if the class itself were to handle the request, information could easily leak across requests. It also puts the division of labour mentioned above into practice: handling the request is an instance-level responsibility, so the class simply forwards the `call` to such an instance.

The `route!` method (an instance method, not to be confused with the earlier class method `route`) which is invoked from the instance method`call` is really the heart of the matter. Given an incoming request, `route!` attempts to fetch a matching route from the `routes` array maintained by the class. If successful, the Proc object stored for that route is called. The return value of that call determines the body of our HTTP response. If, on the other hand, no matching route is found, we send a 404 response to the client.

To see this in action, let's add `require 'rack'` to the top of the file, and the following code to the bottom:

```ruby
Frankie::Application.get('/') { "Frankie says hello." }
Rack::Handler::WEBrick.run Frankie::Application
```

Run the code (the file is [here][10]), point your browser to `localhost:8080` (8080 is the port [set by the `Rack::Handler::WEBrick.run` method][11]), and you will be greeted by Frankie.

So we got ourselves the beginnings of a web framework, or the beginnings of a „tool for solving HTTP“, if you prefer. But, of course, we are just getting started. In [part 02 of the series][12], we will have a look at one of the signature features of Sinatra: it’s elegant top level DSL.

[1]:	http://sinatrarb.com
[2]:	/2018/06/02/frankie-reaches-for-the-top/
[3]:	/2018/06/03/frankie-sees-a-pattern/
[4]:	/2018/06/04/frankie-likes-cookies/
[5]:	/2018/06/04/frankie-likes-cookies/
[6]:	https://github.com/benrodenhaeuser/frankie/blob/master/examples/quotes/app.rb
[7]:	https://github.com/sinatra/sinatra/blob/master/lib/sinatra/base.rb
[8]:	https://github.com/benrodenhaeuser/frankie
[9]:	https://rack.github.io
[10]:	https://github.com/benrodenhaeuser/frankie/blob/master/iterations/01_hello_frankie/frankie.rb
[11]:	https://github.com/rack/rack/blob/42e48013dd1b6dbda990dfa3851856c199b0b1f9/lib/rack/handler/webrick.rb#L32
[12]:	/2018/06/02/frankie-reaches-for-the-top/