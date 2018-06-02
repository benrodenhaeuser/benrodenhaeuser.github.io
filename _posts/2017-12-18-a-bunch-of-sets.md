---
title: "A Bunch of Sets"
description: "A generic implementation of classical sets, multisets and fuzzy sets."
---

Ruby comes with a [`Set` class](https://github.com/ruby/ruby/blob/trunk/lib/set.rb) as part of its standard library, and there is also a [`Multiset` class](https://github.com/maraigue/multiset/blob/master/lib/multiset.rb) available as a gem. Both classes uses hashes internally. However, the two libraries are completely separate, so, of course, they do not share any code. This is somewhat regrettable, since—as we will see during the course of this post—sets and multisets have quite a bit in common. For this reason, I thought that it would be a nice exercise to write a more generic set class from scratch that would allow us to derive the functionality provided by the above-mentioned classes by inheritance. For good measure, I decided to throw fuzzy sets into the mix, another type of set with useful applications. The result could be called a polymorphic approach to modeling various types of sets in Ruby. This post is a tutorial-style presentation of what I came up with. If you don't care much for lengthy explanations, head [straight to Github](https://github.com/benrodenhaeuser/sets) to have a look at the code.

## Classical sets, multisets, and fuzzy sets

Let's first get an overview of the types of collections we are interested in by means of some quick examples.

### Classical Sets

Supppose we wanted to concisely represent the letters occuring in a word, while disregarding their sequential order as well as the number of times they occur in the word. A classical set would be a good choice of data structure for this task. For instance, the word "learner" could be represented by the set

> `{ a, e, l, r, n }`.

The word "learn" corresponds to the same classical set, as it contains the same letters. The word "land", on the other hand, corresponds to the set

> `{ a, l, n, d }`.


Taking the intersection of the two sets, which collects the elements occuring in both of them, we obtain the set `{ a, l, n }`, which captures the overlap of the two words in terms of letters contained—a crude measure of what they have in common. So sets allow us to zoom in on questions of membership, while disregarding other aspects of particular entities we wish to study.

### Multisets

Suppose now we would like to count *how often* letters occur in a given word or text, while (still) disregarding their order. A multiset would be an appropriate data structure to accomplish this. For example, the above word "learner" corresponds to the multiset

> `{ a, e, e, l, r, r, n }`.

Notice that the word "learn" would be represented by a different multiset, namely

> `{ a, e, l, r, n }`.

So multisets make finer distinctions than classical sets.

A more concise way to represent a multiset is by means of key-value notation. In this notation, our multiset representation of the word "learner" would be written as

> `{ a: 1, e: 2, l: 1, r: 2, n: 1 }`

In a programming context, the elements of a set (be it a classical set or a multiset) are often called *keys*. The above multiset has five distinct keys: "a", "e", "l", "r" and "n". In a multiset, each key comes with a count, the value associated with the key, which we will refer to as the *score* for that key. The score for the key "e" in the above multiset, for example, is 2.

### Fuzzy sets

Fuzzy sets also make finer distinctions compared to classical sets. However, they generalize classical sets in a different direction. As we just saw, in a multiset, the score for a particular key represents *multiplicity* of membership (how many times does the key occur in the set?). In a fuzzy set, the score indicates *degree of membership*. So besides an element being "fully contained" in the set or "not contained", it may also be "partially contained" in the set, so to speak.

To see how this can be useful, take this example: consider the words "learner", "learn", "learned", and "lean". We might wish to capture how similar each of these words is to some other word, let's say the word "learner" again. The similarity of "learner" to itself is perfect, since no edit (letter change) is required to transform one into the other. They are the same, after all. On to the more interesting cases: the word "learned" is very similar to "learner" – substituting the last letter will transform the former into the latter. "learn" is also very similar to "learner", but a little less so – deleting the last two letters from "learner" results in "learner", requiring two steps rather than one. The word "lean" is again a bit less similar to "learner", requiring one additional deletion. So to transform each of the words given into "learner" requires:  

- "learner": 0 edits
- "learned": 1 edit
- "learn": 2 edits
- "lean": 3 edits

For the sake of exposition, let us settle on 3 as the—pretty arbitrarily chosen—treshold from which onwards two words to be considered completely dissimilar, or "not similar at all". Then we can map our edit counts to a scale from 0 to 1, and represent our findings as a fuzzy set which scores the key "learner" with 1.0, "learned" with 0.66, "learn" with 0.33 and "lean" with 0.0, or, using key-value notation:

> `{ learner: 1.0, learned: 0.66, learn: 0.33, lean: 0.0 }`


In this fuzzy set, the degree of each element is to be interpreted as the degree of similarity to our target word "learner".

## The `SetMap` class and its children

Equipped with some basic understanding of our problem domain, let us begin to develop the main ingredients for a Ruby model of sets that encompasses the types of sets we have discussed (as well as potentially other ones). We start by discussing a `SetMap` class that captures the commonalities of classical sets, fuzzy sets, and multisets, while allowing us to easily define each of these specific types via inheritance.

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

As we will see below, `each_pair` forms the basis for all our methods that iterate over sets. This includes pretty much all the interesting operations on sets—`union`, `intersection`, and the like. Since `each_pair` is aliassed as `each`, it also allows us to include the `Enumerable` module, which any respectable Ruby collection class should have access to.

## The `SetLike` module

The preceding methods, and the `SetMap` class that defines these methods, serve as a wrapper around our hash table. We have also implemented a mechanism for specifying what constitutes a valid score for a given type of set. And we have provided our three target classes that inherit from `SetMap`. The basics of our model are thus in place.

What remains to be implemented is all the interesting operations on sets! The remaining part of the interface will, however, not interact with the internally used hash table directly, but only through the interface developed so far.

For the purpose of implementing those additional operations, we open a new module `SetLike`, which we include in `SetMap`. Since our target classes `ClassicalSet`, `FuzzySet` and `MultiSet` inherit from `SetMap`, they will also be able to access the functionality provided by `SetLike`.

### Division of Labor

The division of labor we adopt here takes a cue from the place the `Enumerable` module occupies in Ruby's design. `Enumerable` provides a number of useful methods for working with collections to any class that chooses to include it. In doing so, `Enumerable` assumes that the class implements an `each` method, which forms the basis for all the methods `Enumerable` defines. Beyond this, however, `Enumerable` does not (need to) know anything about the class using it. Here, we do something very similar:

- `SetLike` provides most of the functionality commonly associated with sets.
- `SetLike` assumes that any class that uses it implements the instance methods `retrieve`, `insert`, `delete`, `each` and `size`.
- `SetLike` does not make any further assumptions about the internals of the class using it.

In particular, none of the methods in `SetLike` need to know that we are using a hash for internal storage. This draws a distinction between methods that do need to know that we have chosen to represent sets with hash tables (they go in the `SetMap` class), and methods that don't need to know this (they go in the `SetLike` module), and thus encapsulates the internal state of a set in `SetMap`. As long as we keep the public interface of `SetMap` stable, we could just as well reimplement all its methods using a binary search tree instead of a hash for storing a set, say: `SetLike` will not care.

### Operations on sets

We would like to implement the usual operations on sets, like `union`, `intersection`, and `difference`. Since they all follow essentially the same pattern, we focus on just one of them, `union!` (the  destructive version of `union`).

Following the example established by Ruby's [`Set` class](https://github.com/ruby/ruby/blob/trunk/lib/set.rb), we first implement a helper method `SetLike#do_with` that yields to a block:

```ruby
def do_with(other)
  unless other.instance_of?(self.class)
    raise SetError, "#{self.class} instance needed"
  end

  return other.each unless block_given?
  other.each { |key, val| yield([key, val]) }
end
private :do_with
```

This methods takes care of the type-checking for us. We would not, e.g., want to subtract a fuzzy set from a classical set, as the result will not in general be a classical set. The above guard clause ensures that the operations we will define are only carried out for two objects that belong to the same target class. Beyond this, `do_with` simply yields the key-value pairs of the set passed to it as an argument. Using `do_with`, we implement `union!` as follows:

```ruby
def union!(other)
  do_with(other) do |key, _|
    self[key] = [self[key], other[key]].max
  end
  self
end
```

The union of a given set with another one is defined by maximizing scores for given keys across the two sets. This is how the union is usually defined, and it yields the expected results.

```ruby
# SetMap::from_hash(hsh) creates a new set instance and populates it
# with the key-value pairs from the given hash `hsh`

multi_set1 = MultiSet.from_hash(2 => 1, 3 => 2)
multi_set2 = MultiSet.from_hash(2 => 2, 4 => 1)
multi_set1.union!(multi_set2)

multi_set1 == MultiSet.from_hash(2 => 2, 3 => 2, 4 => 1) # true
```

`union!` implements a notion of "combining what is contained in two given sets". There is a similar, yet slightly different notion which is interesting from the perspective of our polymorphic approach: the *sum* of two sets. So let's briefly digress:

```ruby
def sum!(other)
  do_with(other) { |key, val| insert(key, val) }
  self
end
```

Rather than maximizing scores, as `union!` did, `sum!` adds the scores given by the other set to the scores of the receiver. For classical sets, `sum!` and `union!` amount to the very same thing:

```ruby
# SetMap::[](*list) creates a new set instance and turns the
# members of `list` into keys of the new instance.

set1 = ClassicalSet[1, 2, 3]
set2 = ClassicalSet[2, 3, 4]

set3 = ClassicalSet[1, 2, 3]
set4 = ClassicalSet[2, 3, 4]

set1.union!(set2) == set3.sum!(set4) # true
```

This is why Ruby's own `Set` class simply defines `+` (the sum operator) to be an alias of `|` (the union operator). However, for other types of sets, sum and union are not always the same. This is because taking the maximum of two scores is not generally the same as summing up those two scores! For example:

```ruby
set1 = FuzzySet.from_hash(2 => 0.4)
set2 = FuzzySet.from_hash(2 => 0.3)

set3 = FuzzySet.from_hash(2 => 0.4)
set4 = FuzzySet.from_hash(2 => 0.3)

set1.sum!(set2)
set3.union!(set4)

set1 == FuzzySet.from_hash(2 => 0.7) # true
set3 == FuzzySet.from_hash(2 => 0.4) # true
```

Our model captures all of this correctly.

### Set predicates

A classical set `A` is a subset of a classical set of `B` if any element of `A` is also an element of `B`. This can be expressed in terms of keys and their associated scores by saying that the score for any key in `A` is less than or equal to the score for that same key in `B`. This definition also applies to multisets, and fuzzy sets, so that, again, a common implementation is possible. Here is a first stab at the `SetLike#subset?` method:

```ruby
def subset?(other)
  return false unless other.instance_of?(self.class)

  all? do |key, _|
    self[key] <= other[key]
  end
end
alias <= subset?
```

Following the pattern established by the `do_with` method discussed above, however, it makes sense to extract the "key comparison" functionality to a separate `compare_with?` method that takes a block (you may want to check out the [code of the multiset gem](https://github.com/maraigue/multiset/blob/master/lib/multiset.rb)—the gem author does exactly this).

```ruby
def keys
  each.map(&:first)
end

def compare_with?(other)
  return false unless other.instance_of?(self.class)

  (keys | other.keys).all? do |key|
    yield(self[key], other[key])
  end
end
```

According to line 2 above, the keys of a set object are given by the first component of each key-value pair. `SetLike#compare_with?` then iterates over the keys of both `self` and `other`, and yields the corresponding values to the block. This allows us to implement `subset?` as follows:

```ruby
def subset?(other)
  compare_with?(other) do |s, o|
    s <= o
  end
end
alias <= subset?
```

Definitions for the other common set predicates (`proper_subset?`, `superset?` and `proper_superset?`) are similar, so we omit them here.

### Equivalence

When are two sets `A` and `B` the same? Again, there is an answer that works for all three target classes: the two sets should be in a mutual inclusion relation, i.e., `A` should be a subset of `B`, and `B` a subset of `A`. However, invoking `subset?` twice seems slightly redundant, since in the worst case, this amounts to performing every comparison twice. Using the `compare_with?` method defined above, we can more simply write the following code:

```ruby
def equivalent?(other)
  compare_with?(other) do |s, o|
    s == o
  end
end
alias == equivalent?
alias eql? equivalent?
```

Notice that we have aliassed the `equivalent?` method both as `==` and `eql?`. We have already taken the `==` method for granted in some earlier snippets. Now what about `eql?`? This brings us to our final topic for today:

### Nested sets

Unless overridden, the `Object#eql?` method considers two objects to be the same if they are identical (i.e., are stored at the same location in memory). In the current context, overriding `Object#eql?` is critical, because `eql?` is the method that Ruby uses when accessing hash keys. Let's leave the context of our `SetLike` module for a moment, and consider this line of Ruby code:

```ruby
some_hash[some_obj]
```

When executing this line, Ruby will check if there is a key `key` to be found in `some_hash` with the property that `some_obj.eql?(key)`. If so, the value for `key` will be returned.

For our purposes, this process of looking up keys in a hash is crucial because (1) we are using hashes for storing set membership information, and (2) we would like to be able to model *nested* sets, which are sets that have sets among their keys. Consider:

```ruby
# SetMap::[](*list) creates a new set instance and turns the
# members of `list` into keys of the new instance.

set1 = ClassicalSet[1, 2, 3]
set2 = ClassicalSet[1, 2, 3]
set3 = ClassicalSet[set1, 4]
set4 = ClassicalSet[set2, 4]

set3 == set4 #=> ?
```

Now the question is whether `set3` and `set4` are the same set. It seems that the answer should be yes, because, after all, they *contain the same elements*. Assume, however, for a moment that we had not overridden `eql?`. Then `set3` and `set4` do *not* come out the same in the sense of `==` because `set1` and `set2` do not reference the same object, which implies that `set3[set1] == set4[set1]` will return false, for the simple reason that `set1` is not considered a key in the set `other`, since it is not the case that `set2.eql?(set1)`. So overriding `eql?`, like we did above, is indeed critical.

### The `hash` method

As a final aside: For our set comparisons to work, we also need to override the `Object#hash` method so as to ensure that two set objects that are `eql?` have the same return value when `hash` is called on them. This can be achieved, e.g., like this:

```ruby
def hash
  each.map(&:hash).sum
end
```

Here, we simply map each key-value pair (a two-element array) yielded by `each` to its `hash` value and sum up the result, trusting that `Array#hash` is implemented in a meaningful way. And this indeed ensures that `eql?` sets have the same `hash` return value.

### Coda

What has been achieved? As mentioned at the beginning of the post, the set functionality that we have discussed is either readily available as part of Ruby's Standard Library (for classical sets), or via an easily accesible Ruby gem (for multisets). However, the code presented here presents a *uniform* perspective on classical sets and multisets. While I have written `SetMap` and its child classes as an exercise for myself, I consider this uniformity an advantage over the pre-existing implementation. We have also seen how easily the approach generalizes to further use cases by considering fuzzy sets.

This has been a long post. I hope I have not overstretched the limits of your patience. While coming up with a first working implementation of the types of sets discussed here was pretty straightforward, arriving at a way to structure and modularize my code that I found convincing myself required me to go back to the drawing board several times. If you have a chance to [check out my code](https://github.com/benrodenhaeuser/sets), your feedback would be greatly appreciated.
