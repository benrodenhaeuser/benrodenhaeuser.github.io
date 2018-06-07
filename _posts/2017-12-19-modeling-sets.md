---
title: "Modeling Sets"
description: 'Part 02 of the "Bunch of Sets" series.'
date: 2017-12-19
---

> This is part 02 of a three part series that starts [here](/2017/12/18/a-bunch-of-sets/).
{: .aside}

Equipped with some basic understanding of our problem domain established in [part 01 of this series](/2017/12/18/a-bunch-of-sets/), let us begin to develop the main ingredients for a Ruby model of sets that encompasses the types of sets we have discussed (as well as potentially other ones). We start by discussing a `SetMap` class that captures the commonalities of classical sets, fuzzy sets, and multisets, while allowing us to easily define each of these specific types via inheritance.

### Hash tables

What do the three types of sets have in common? At first glance, it seems that their internal structure is pretty different: multisets and fuzzy sets have been presented above as consisting of key-value pairs, while classical sets simply consist of a bunch of keys. However, this is merely a matter of representation. In fact, it is rather common to represent a classical set by means of a *characteristic function*, which maps the members of the set to 1, while all other objects from a given domain are mapped to 0. Taking a cue from this, we extend our key-value notation to classical sets, writing the set `{ 0, 1, 2 }`, for example, as

> `{ 0: 1, 1: 1, 2: 1 }`.

From this perspective, it becomes obvious that the membership information for a set—be it a fuzzy set, a classical set, or a multiset—may be stored in a hash table:

```ruby
{ 'a' => 1, 'b' => 1, 'c' => 1 }     # 'classical set'
{ 'a' => 1, 'b' => 1, 'c' => 2 }     # 'multiset'
{ 'a' => 0.3, 'b' => 1, 'c' => 0.6 } # 'fuzzy set'
```

Hash tables will form the basis of our representation of sets. Of course, we would not want to directly expose such a table to the user of our set class. The user need not even be aware that we are using a hash table to store her set. Rather, the hash instance that stores the set keys and their associated scores will be a collaborator object to our set object. The `initialize` method of our `SetMap` class sets the stage for this:

```ruby
class SetMap
  def initialize
    @hash = {}
    @size = 0
  end
end
```

Besides the `@hash` instance variable, we also decide to maintain an instance variable `@size`, in the interest of being able to look up the size of our set in constant time. The size of a set is commonly defined as the sum of the scores of its keys, and the idea is that `@size` will always store this value in an up-to-date fashion. We also make available a getter method `size` that returns the current value of `@size`, omitted here.

### Valid scores

What distinguishes the types of sets we have seen above from each other? It is primarily what counts as a valid score according to each type:

- A classical set either contains or does not contain a particular key, so the only valid scores are 0 and 1.
- A multiset may contain a given key `n` times, where `n` is a non-negative integer.
- A fuzzy set scores a given key to a degree in the unit interval from 0 to 1.

So in each case, we have to be able to express a range of possible values. We set up a bunch of class methods and class instance variables for this purpose:

```ruby
class SetMap
  def self.score_type
    @score_type || raise(SetError, '@score_type not initialized')
  end

  def self.min_score
    @min_score || raise(SetError, '@min_score not initialized')
  end

  def self.max_score
    @max_score || raise(SetError, '@max_score not initialized')
  end

  def self.valid_score?(val)
    val.is_a?(score_type) && (min_score..max_score).cover?(val)
  end
end
```

The first three class methods defined above are getters (on the level of the class object) for the class instance variables `@score_type` (the kind of object we may use as a score for a key), `@min_score` (the smallest value that may be used as a score), and `@max_score` (the largest value that maye be used as a score). The fourth method uses these getters and describes what constitutes a valid score as a predicate.

As the second disjunct of each of the above getter methods tells us loud and clear, we are missing something so far: our class instance variables have not been set to any value! Initializing those class instance variables is precisely the job description of our target classes.

### Target classes

`SetMap` is meant to be subclassed, with each subclass defining a particular set type by specifying a range of legal scores via the class instance variables `@score_type`, `@min_score` and `@max_score`. Here is the code for classical sets:

```ruby
class ClassicalSet < SetMap
  @score_type = Integer
  @min_score = 0
  @max_score = 1
end
```

In other words, the only valid scores for the keys of classical sets are the integers `0` and `1`. For fuzzy sets, we write:

```ruby
class FuzzySet < SetMap
  @score_type = Numeric
  @min_score = 0
  @max_score = 1
end
```

So any `Numeric` instance in the closed interval `[0, 1]` is a valid score for a fuzzy set key (we choose `Numeric` so as to allow both floats and integers). Finally, for multisets:

```ruby
class MultiSet < SetMap
  @score_type = Integer
  @min_score = 0
  @max_score = Float::INFINITY
end
```

The `Float::INFINITY` constant has the property that `x < Float::INFINITY` for any numeric `x`. Setting `@max_score` to `Float::INFINITY` is thus a way of saying that, for multisets, there is no maximal score: any non-negative integer is allowed.

And this is really all there is to it! Specializing the capabilities of `SetMap` to a particular target class boils down to providing appropriate values for a bunch of class instance variables.

Of course, we have not yet demonstrated what the interface for `SetMap` actually looks like. But from now on, we will write methods that work equally well for all three set types under consideration: classical sets, fuzzy sets, and multisets.

### Key insertion

The most basic part of the interface of any set class is arguably the capability of inserting scores for particular keys. Here is the `SetMap#insert` method:

```ruby
def insert(key, val = 1)
  raise(SetError, 'Illegal value') unless self.class.valid_score?(val)
  old_score = self[key]
  @hash[key] = [self[key] + val, self.class.max_score].min
  @size = @size + (self[key] - old_score)
  self
end
```

The general idea of this method is to increment the score of `key` by `val`. As per line 2 of the snippet, this will work only if `val` is a valid score according to the implementation of `valid_score?` (which in turn depends on the values of the class instance variables `@score_type`, `@min_score` and `@max_score`). If that is the case, we use what is called a *bounded sum* to add `val` to `self[key]`, capping off the sum at `@max_score` (line 4).

Let's try this out using our target classes:

```ruby
fuzzy_set = FuzzySet.new
fuzzy_set.insert('a', 0.5)
fuzzy_set.insert('a', 0.3)
fuzzy_set #=> #<FuzzySet: {"a": 0.8}>

multi_set = MultiSet.new
multi_set.insert('a')
multi_set.insert('a', 2)
multi_set #=> #<MultiSet: {"a": 3}>

classical_set = ClassicalSet.new
classical_set.insert('a')
classical_set.insert('a')
classical_set #=> #<ClassicalSet: {"a": 1}>
```

These are the desired results (assuming a—standard—`inspect` method which we have not shown). Notice that the score range we have specified for classical sets in tandem with the bounded sum ensures that inserting the same key twice has the same effect as inserting it once: the sum of `1` and `1` bounded by `1` is again `1`.

Returning to the earlier snippet, we also need to keep track of the size of our set (line 5). Here, we also neutralize rounding errors that might occur for types of sets that allow [floating point numbers](http://floating-point-gui.de) as scores.

### Key retrieval

Next, consider `SetMap#retrieve`:

```ruby
def retrieve(key)
  @hash[key] ? @hash[key] : 0
end
alias [] retrieve
```
The `retrieve` method (which we alias as `[]`) wraps the element reference method of our internal hash. If the hash does not contain a certain key, `@hash[key]` will return `nil`. In that case, `retrieve(key)` (or, equivalently as per our alias, `self[key]`) will return `0`. Alternatively, we could haver set a default value for `@hash`, but the current way seems slightly more explicit.

Observe that key retrieval is fast: accessing a hash key takes constant time on average ([disregarding some fine-print](https://lemire.me/blog/2009/08/18/do-hash-tables-work-in-constant-time/)), i.e., as the number of keys in a hash increases, the average time necessary to recover the value for a key does not increase. This is one of the main reasons why using hash tables to model sets is an attractive choice.

### Key removal

While it would be possible to tweak our approach and express removal of a key as insertion with a negative score, we prefer to keep things simple here:

```ruby
def remove(key, val = 1)
  raise(SetError, 'Illegal value') unless self.class.valid_score?(val)
  old_score = self[key]
  @hash[key] = [self[key] - val, self.class.min_score].max
  @size = @size - (old_score - self[key])
  self
end
```

`SetMap#remove` is perfectly symmetric to the earlier `insert` method, using a bounded difference instead of a bounded sum. For our three target classes, this ensures that negative scores cannot occur.

### Enumeration

The below `SetMap#each_pair` method enumerates set keys and their associated scores in a straightforward manner, piggybacking on `Hash#each_pair`. Notice that we only yield key-value pairs for which the value is non-zero, since a key scored with value `0` is not considered part of our set.

```ruby
def each_pair
  return to_enum(:each_pair) unless block_given?

  @hash.each_pair do |key, val|
    yield([key, val]) if val != 0
  end

  self
end
alias each each_pair
```

As we will see in the next post, `each_pair` forms the basis for all our methods that iterate over sets. This includes pretty much all the interesting operations on sets—`union`, `intersection`, and the like. Since `each_pair` is aliassed as `each`, it also allows us to include the `Enumerable` module, which any respectable Ruby collection class should have access to.

> Continue to [part 03 of the series](/2017/12/20/operations-on-sets/) where we discuss operations on sets.
{: .aside}
