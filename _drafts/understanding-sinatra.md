---
title: "Understanding Sinatra"
description: "Building a toy version of a popular Ruby framework from the ground up."
---


We are going to develop our toy version of Sinatra in a number of iterations, starting "tiny", and building towards "small". This corresponds to how I built Frankie, too, even though this blog post makes the process perhaps appear a little more orderly than it really was.

## 01. Hello Frankie

At its core, Sinatra is (1) a mechanism for storing routes, and (2) a mechanism for handling requests based on the routes stored. So this is where we start.

If you investigate the Sinatra source code, you will see that part (1), route storage, is a class task, while part (2), request handling, happens at the instance level. Let's first see how to store routes.

```ruby
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
```

Routes are stored in an array which we can access via the `routes` class method. Invoking the `get` and `post` method defined above leads to a route being stored. As you can see by inspecting the `route` method, a route has three components: an HTTP `verb`, a URL `path`, and a block (a Proc object, to be precise). If the `verb` for a given request is `GET`, and its `path` is `'/'`, then you can imagine that the block will determine how to handle that request.

Now, how are requests handled?  

```ruby
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
```

## 02. Frankie goes top level


New module `Frankie::Delegator`:

```ruby
module Delegator
  def self.delegate(method_name)
    define_method(method_name) do |*args, &block|
      Application.send(method_name, *args, &block)
    end
  end

  delegate(:get)
  delegate(:post)
end
```

We also need (at the top level):

```ruby
extend Frankie::Delegator
```

If we just did this, we could actually already run a 'Hello world' route. However, more work needs to be done. E.g., we want to be able to use the `params` method in our route blocks.

Change the `Application#route!` method to use `instance_eval`:

```ruby
def route!
  match = Application.routes
                     .select { |route| route[:verb] == @verb }
                     .find   { |route| route[:path] == @path }
  return status(404) unless match

  body instance_eval(&match[:block])
end
```

And a `Templates` module:

```ruby
module Templates
  def path_to_template(app_root, template)
    template_dir = File.expand_path('../views', app_root)
    "#{template_dir}/#{template}.erb"
  end

  def erb(template)
    b = binding
    app_root = caller_locations.first.absolute_path
    content = File.read(path_to_template(app_root, template))
    ERB.new(content).result(b)
  end
end
```

## 03. Frankie recognizes patterns

Change the `route` class method, and add `compile` class method:

```ruby
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
```

Change the `route!` instance method:

```ruby
class Application
  def route!
    match = Application.routes
                       .select { |route| route[:verb] == @verb }
                       .find   { |route| route[:pattern].match(@path) }
    return status(404) unless match

    # CHANGE in 0.3: process captured groups
    values = match[:pattern].match(@path).captures
    params.merge!(match[:keys].zip(values).to_h)
    body(instance_eval(&match[:block]))
  end
end
```

## 04. Frankie plays catch

The `Application#call` method used to invoke the `Application#route!` method. It now reads `catch(:halt) { dispatch! }`:

```ruby
class Application
  # CHANGE: changed method in 0.4:
  def call(env)
    @request  = Rack::Request.new(env)
    @verb     = @request.request_method
    @path     = @request.path_info

    @response = {
      status:  200,
      headers: headers,
      body:    []
    }

    # CHANGE: changed line in 0.4:
    catch(:halt) { dispatch! }

    @response.values
  end
end
```

Define `dispatch!`, change `route!`, define `not_found` and `redirect`:

```ruby
class Application
  # CHANGE: new method in 0.4
  def dispatch!
    route!
    not_found
  end

  # CHANGE in 0.4: handle not_found separately, use throw:
  def route!
    match = Application.routes
                       .select { |route| route[:verb] == @verb }
                       .find   { |route| route[:pattern].match(@path) }
    return unless match

    values = match[:pattern].match(@path).captures
    params.merge!(match[:keys].zip(values).to_h)
    body(instance_eval(&match[:block]))
    # CHANGE in 0.4: new line
    throw :halt
  end

  # CHANGE: new method in 0.4
  def not_found
    status 404
    body "<h1>404 Not Found</h1"
    throw :halt
  end

  # CHANGE: new method in 0.4
  def redirect(uri)
    status (@verb == 'GET' ? 302 : 303)
    headers['Location'] = uri
    throw :halt
  end
end
```

## 05. Frankie likes cookies

Setting up middleware

As an example, we will set up Frankie to use cookie-based session management as provided by `Rack::Session::Cookie` (which is also what Sinatra uses by default).

```ruby
class Application
  class << self
    # CHANGE: changed method
    def call(env)
      prototype.call(env)
    end

    # CHANGE: new method
    def prototype
      @prototype ||= new
    end

    # CHANGE: new alias
    alias new! new

    # CHANGE: new/overridden method
    def new
      instance = new!
      build(instance).to_app
    end

    # CHANGE: new method
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

    # CHANGE: new method
    def use(middleware, *args)
      (@middleware ||= []) << [middleware, args]
    end
  end
end
```

Rename `call` method to `call!`, introduce new `call` method:

```ruby
class Application
  # CHANGE: new method
  def call(env)
    dup.call!(env)
  end

  # CHANGE: this method used to be called `call`.
  # It is otherwise unchanged.
  def call!(env)
    @request  = Rack::Request.new(env)
    @verb     = @request.request_method
    @path     = @request.path_info

    @response = {
      status:  200,
      headers: headers,
      body:    []
    }

    catch(:halt) { dispatch! }

    @response.values
  end
end
```

We also add a `session` method for accessing the session:

```ruby
class Application
  # CHANGE: new method
  def session
    @request.session
  end
end
```

## 06. Frankie returns

For flexible return values, we need to introduce one additional level of indirection. Within the `call!` method, we invoke `invoke`:

```ruby
class Application
  class << self
    def call!(env)
      @request  = Rack::Request.new(env)
      @verb     = @request.request_method
      @path     = @request.path_info

      @response = {
        status:  200,
        headers: headers,
        body:    []
      }

      # CHANGE: we use invoke now
      invoke { dispatch! }

      @response.values
    end
  end
end
```

`invoke` is defined as follows:

```ruby
class Application
  class << self
    def invoke
      caught = catch(:halt) { yield }
      return unless caught

      case caught
      when Integer then status caught
      when String then body caught
      else
        body(*caught.pop)
        status caught.shift
        headers.merge!(*caught)
      end
    end
  end
end
```

### Finishing touches

The code on github includes some additional minor changes.
