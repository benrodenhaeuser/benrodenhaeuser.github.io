---
title: "Frankie Sees a Pattern"
description: 'Defining parametrized routes: part 03 of the "Sinatra from Scratch" series.'
date: 2018-06-03
---

> This is part 03 in a four part series of blog posts that starts [here][1].
{: .aside}

In the [previous installation][2] of this blog post series, Frankie picked up a bit of Sinatra’s signature DSL magic. Next, let’s make Frankie a bit more capable. What is sorely missing from our toy version of Sinatra so far is the ability to *parametrize routes*:

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

Next, let’s adapt our mechanism for *storing* routes with parameters. Keeping in mind what was said in [part 01 of this series][3], this needs to happen at the *class level*. The method we need to change is the class method `route`.

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
enda
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

> Sinatra goes out of its way to allow users flexibility in making use of route parameters. In addition to strings, regular expressions are allowed as route paths, and route paths may contain wildcards („splats“) and/or optional parameters. So we have merely scratched the surface here. Also, the way Sinatra stores and processes parametrized routes has changed somewhat with the advent of the [Mustermann string processing library][4] in Sinatra 2.0. Our approach here is closer to how things used to work up to Sinatra 1.4.x.
{: .aside}

Try it out using [this file][5] (which contains the Frankie code as of the end of this part of our series), requesting your favourite song from your favourite album.

Next up in the series: [working with Rack middleware][6].

[1]:	/2018/06/01/sinatra-from-scratch/
[2]:	/2018/06/02/frankie-reaches-for-the-top/
[3]:	/2018/06/01/sinatra-from-scratch/
[4]:	https://github.com/sinatra/mustermann
[5]:	https://github.com/benrodenhaeuser/frankie/blob/master/iterations/03_frankie_sees_a_pattern/frankie.rb
[6]:	/2018/06/04/frankie-likes-cookies/
