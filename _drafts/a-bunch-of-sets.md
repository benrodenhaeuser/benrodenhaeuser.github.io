# A Bunch of Sets

Ruby has a [set class](http://ruby-doc.org/stdlib-2.4.1/libdoc/set/rdoc/Set.html) as part of its standard library, and there is also a [multiset implementation](https://github.com/maraigue/multiset) available as a gem. Both uses hashes for internal storage. However, the two libraries do not share any code. This is somewhat regrettable, since—as we will discuss below—sets and multisets have quite a bit in common. For this reason, I thought that it would be a nice exercise to implement a more generic set class from scratch from which (part of) the functionality provided by these two classes can be derived by inheritance. For good measure, I decided to throw fuzzy sets into the mix, another type of set with useful applications. The result is a polymorphic approach to modeling various types of sets in Ruby. If you don't care much for lengthy explanations, head [straight to Github](https://www.github.com) to read the code.

## Classical sets, multisets, and fuzzy sets

Let's first get a quick overview of the types of collections we are interested in modeling by means of some motivating examples.

**Classical Sets.** Supppose we wanted to concisely represent the letters occuring in a word, while disregarding their sequential order as well as the number of times they occur in the word. A classical set is a good choice for the job. For instance, the word "learner" could be represented by the set

$$\lbrace a, e, l, r, n \rbrace$$

Notice that the word "$\text{learn}$" would be represented by the very same set, i.e., $\lbrace a, e, l, r, n \rbrace$. So sets allow us to zoom in on the question of membership: is the letter contained in the word or not? Other salient aspects of words, in particular letter counts, are disregarded.

**Multisets.** Suppose now we would like to count how often letters occur in a given word or text, while disregarding their order. A multiset would be an appropriate data structure to accomplish this. For example, the word "$\text{learner}$" could be represented by the multiset

$$\lbrace a, e, e, l, r, r, n \rbrace$$

Notice that the word "$\text{learn}$" would be represented by a different multiset, namely $\lbrace a, e, l, r, n \rbrace$. So multisets make finer distinctions than classical sets.

A more concise way to represent a multiset is by means of key-value notation. Our multiset representation of the word "learner" would then be written as

$$\lbrace a: 1, e: 2, l: 1, r: 2, n: 1\rbrace$$

The elements of a multiset are often called *keys*. The above multiset has five distinct keys ($a$, $e$, $l$, $r$ and $n$). We shall refer to the value associated with a particular key as the *score* for that key. In the above multiset, the score for the key $e$ is $2$.

**Fuzzy sets.** Fuzzy sets also make finer distinctions compared to classical sets. However, they go into a different direction. In a multiset, the score for a particular key indicates multiplicity of membership. In a fuzzy set, we do not allow keys to occur multiple times. Instead, we allow membership  *to a degree*. This allows us, for example, to model situations where the similarity of various items is at stake.

Consider the words "$\text{learner}$", "$\text{learn}$", "$\text{learned}$", and "$\text{lean}$". We might wish to capture how similar these words are to the word "$\text{learner}$". The similarity of "$\text{learner}$" to itself is perfect, since no edit is required to transform one into the other. They are the same, after all. On to the more interesting cases: the word "$\text{learned}$" is very similar to "$\text{learner}$" – substituting the last letter in "$\text{learned}$" will transform it into "$\text{learner}$". "$\text{learn}$" is also very similar to "$\text{learner}$", but a little less so – deleting the last two letters from "$\text{learner}$" results in "$\text{learner}$", requiring two steps rather than one. The word "$\text{lean}$" is again a bit less similar to "$\text{learner}$", requiring one more deletion step. So to transform each of the words into "learner" requires:  

- "$\text{learner}$": 0 edits
- "$\text{learned}$": 1 edit
- "$\text{learn}$": 2 edits
- "$\text{lean}$": 3 edits

Suppose now that we settle—pretty arbitrarily but for the sake of exposition—on 3 edits as the treshold from which onwards two words are to be considered perfectly dissimilar or "not similar at all". Then we can map our edit counts to the 0-1-scale and represent our findings as a fuzzy set which contains "$\text{learner}$" with degree 1.0, "$\text{learned}$" with degree 0.66, "$\text{learn}$" with degree 0.33 and "$\text{lean}$" with degree 0.0, or, using key-value notation:

$$\lbrace\text{learner}: 1.0, \text{learned}: 0.66, \text{learn}: 0.33, \text{lean}: 0.0\rbrace$$

In this fuzzy set, the degree of each element is to be interpreted as the degree of similarity to our target word "learner".

## The `SetMap` class and its children

Let us now begin to develop the main ingredients for a Ruby model of sets, a model that encompasses the types of sets we have discussed (as well as potentially other ones). We start by discussing a `SetMap` class that captures the commonalities of classical sets, fuzzy sets, and multisets, while allowing us to easily define each of these types via inheritance.

**Hash tables.** What do the three types of sets have in common? At first glance, it seems that their internal structure is pretty different: multisets and fuzzy sets seem to consist of key-value pairs, while classical sets consist of a bunch of keys only. However, this is merely a matter of representation. In fact, it is rather common to represent a (classical) set by means of a *characteristic function*, which maps the members of the set to $1$, while all other objects from a given domain to $0$. So we can extend the key-value representation from above to classical sets, writing the set $\lbrace 0, 1, 2\rbrace$, for example, as $\lbrace 0: 1, 1: 1, 2: 1\rbrace$.

It now requires only a tiny step to conclude that the membership information for a particular set (be it a fuzzy set, a classical set, or a multiset) may be stored in a hash table, such as

```ruby
{ 'a' => 1, 'b' => 1, 'c' => 1 }
```

or

```ruby
{ 'a' => 1, 'b' => 1, 'c' => 2 }
```

Of course, we would not want to directly expose such a hash to the user of our set class. The user need not even be aware that we are using a hash to store her set. The hash instance that stores the set keys and their scores will thus be a collaborator object to our set. The `initialize` method of our `SetMap` class sets the stage for this:

```ruby
class SetMap
  include SetLike

  def initialize
    @hash = {}
    @size = 0
  end
end
```

The size of a set is defined as the sum of the scores of its keys. We decide to maintain an instance variable `@size` that tracks the size, in the interest of being able to look up the size of our set in constant time. We will talk about the `SetLike` module included in the `SetMap` class in the next section.

**Valid scores.** What distinguishes the set types we have seen from each other? It is primarily the notion of a valid score:

- A classical set either contains or does not a particular key, so the only valid scores are $0$ and $1$.
- A multiset contains a given key $n$ times, where $n$ is a non-negative number.
- A fuzzy set scores a given key to a degree in the real interval from $0$ to $1$.

In each case, there is a range of particular values. We model this by means of a bunch of class methods and class instance variables:

```ruby
class SetMap
  class << self
    def score_type
      @score_type || raise(SetError, '@score_type not initialized')
    end

    def min_score
      @min_score || raise(SetError, '@min_score not initialized')
    end

    def max_score
      @max_score || raise(SetError, '@max_score not initialized')
    end

    def valid_score?(val)
      (min_score..max_score).cover?(val) && val.is_a?(score_type)
    end
  end
end
```

The `class << self ... end` block in the above snippet indicates that the methods defined in the block are class methods. The first three are getters (on the level of the class object) for the class instance variables `@score_type` (the kind of object we may use as a score for a key), `@min_value` (the smallest value that may be used as a score), and `@max_value` (the largest value that maye be used as a score). The fourth method uses these getters and describes in the form of a predicate what constitutes a valid score.

As the second disjunct of each getter methods above tells us loud and clear, we are missing something so far: our class instance variables have not been initialized so far, and there is so far no obvious way to do so.

**Target classes.** Initializing those class instance variables is precisely the job description of our target classes. `SetMap` is meant to be subclassed, with each subclass defining a particular set type by specifying the range of legal scores via `@score_type`, `@min_score` and `@max_score`. Here is the code for classical sets:

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

Any instance of `Numeric` in the interval betwwen 0 and 1 is a valid score for a fuzzy set key. Finally, for multisets:

```ruby
class MultiSet < SetMap
  @score_type = Integer
  @min_score = 0
  @max_score = Float::INFINITY
end
```

The `Float::INFINITY` constant has the property that `x < Float::INFINITY` for any numeric `x`. Setting `@max_score` to `Float::INFINITY` is thus a way of saying that, for multisets, there *is no* maximal score: any non-negative integer is allowed.

And this is really all there is to it! Specializing the capabilities of `SetMap` to a particular target class boils down to providing appropriate values for a bunch of class instance variables. Of course, we have not demonstrated how the interface for `SetMap` actually looks like. But from now on, we will write methods that work equally well for all three scenarios under consideration: classical sets, fuzzy sets, and multisets.

**Key insertion.** The most basic part of the interface of any set class is arguably the capability of inserting scores for particular keys. Here is the `SetMap#insert` method:

```ruby
def insert(key, val = 1)
  raise(SetError, 'Illegal value') unless self.class.valid_score?(val)
  old_score = self[key]
  @hash[key] = [self[key] + val, self.class.max_score].min
  @size = (@size + (self[key] - old_score)).round(1)
end
```

The basic idea of `insert` is to increment the score of `key` by `val`. As per line 2 of the snippet, this will work only if `val` is a valid score according to the implementation of `valid_score?` (which in turn depends on the values of the class instance variables `@score_type`, `@min_score` and `@max_score`). If that is the case, we use what is called a *bounded sum* to add `val` to `self[key]`, capping off the sum at the value of `@max_score` (line 4). We also need to keep track of the size of out set, which happens in line 5. Here, we also keep track of rounding errors that might occur for types of sets that allow floating point numbers as scores.

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

These are the desired results (assuming a—standard—`inspect` method which we have not shown). Notice that the score range we have specified for classical sets ensures that inserting the same key twice has the same effect as inserting it once.

**Key retrieval.**  Next, consider `SetMap#retrieve`:

```ruby
def retrieve(key)
  @hash[key] ? @hash[key] : 0
end
alias [] retrieve
```
The `retrieve` method (which we alias as `[]`) wraps the element reference method of our internal hash. If the hash does not contain a certain key, `@hash[key]` will return `nil`. In that case, `retrieve(key)` (or, equivalently as per our alias, `self[key]`) will return `0`. Alternatively, we could haver set a default value for `@hash`, but the current way seems slightly more explicit.

**Key removal.** While it would be possible to tweak our approach and express removal of a key as insertion with a negative score, we prefer to keep things simple here:

```ruby
def remove(key, val = 1)
  raise(SetError, 'Illegal value') unless self.class.valid_score?(val)
  old_score = self[key]
  @hash[key] = [self[key] - val, self.class.min_score].max
  @size = (@size - (old_score - self[key])).round(2)
end
```

`SetMap#remove` is perfectly symmetric to the earlier `insert` method, using a bounded difference instead of a bounded sum. For our three target classes, this ensures that negative scores cannot occur.

**Enumeration.** The below `SetMap#each_pair` method enumerates set keys and their associated scores in a straightforward manner. Notice that we only yield key-score pairs for which the score is non-zero, since a key with score `0` is not considered to be part of our set.

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

As we will see below, `each_pair` is the basic building block for all our methods that iterate over sets, which includes pretty much all the interesting operations on sets like `union`, and `intersection`. Since `each_pair` is aliassed as `each`, it also allows us to include the `Enumerable` module, which any respectable collection class should have access to.

## The `SetLike` module

The preceding methods serve as a wrapper around the hash table that we use internally to store set keys and their associated scores. We have also implemented a mechanism for specifying what constitutes a valid score for a given type of set. The remaining part of the interface will not interact with the hash directly, but build on top of the machinery put in place so far.

**Division of Labor.** To emphasize the distinction between methods that directly access the state of a set (given by `@hash` and `@size`), and methods that built on top of the latter, we put the remainder of the interface in a module which we call `SetLike`. This module provides much of the functionality commonly associated  with sets, and assumes that any class that uses it implements the instance methods `retrieve`, `insert`, `delete`, `each` and `size` (the latter simply being a getter for the `@size` variable) we have discussed so far.

In particular, none of the methods in `SetLike` need to know that we are using a hash for internal storage. The internal state of a set is thus encapsulated in `SetMap`. As long as we provide the methods listed, we could just as well implement a binary search tree for storing a set.

(TODO: Several advantages:)
- Encapsulate the methods that directly access the internal state of `GenericSet` instances. While nothing forces us to respect this boundary, the division of labor is a useful reminder to stick to this rule. (see below)
- Anyone who implements the interface of `GenericSet` can use `SetLike`.

**Operations on sets.**

(TOOD: `do_with`, union, sum)

**Set predicates.** A classical set $A$ is a subset of a classical set of $B$ if any element of $A$ is also an element of $B$. This can be expressed in terms of keys and their associated scores by saying that the score for any key in $A$ is less than or equal to the score for that same key in $B$. This definition also applies to multisets, and fuzzy sets, so that, again, a common implementation is possible. Here is a first stab at the `SetLike#subset?` method:

```ruby
def subset?(other)
  return false unless other.instance_of?(self.class)

  all? do |key, _|
    self[key] <= other[key]
  end
end
alias <= subset?
```

Following the pattern established by the `do_with` method discussed above, however, it makes sense to extract the "key comparison" functionality to a separate `compare_with?` method that takes a block (you may want to check out the code of the [multiset gem](https://github.com/maraigue/multiset)—the gem author does exactly this).

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

**Equivalence.** When are two sets $A$ and $B$ the same? Again, there is an answer that works for all three target classes: the two sets should be in a mutual inclusion relation, i.e., $A$ should be a subset of $B$, and $B$ a subset of $A$. However, invoking `subset?` twice seems slightly redundant, since in the worst case, this amounts to performing every comparison twice. Using the `compare_with?` method defined above, we can more simply do:

```ruby
def equivalent?(other)
  compare_with?(other) do |s, o|
    s == o
  end
end
alias == equivalent?
alias eql? equivalent?
```

Notice that we have aliassed the `equivalent?` method both as `==` and `eql?`. This brings us to our final topic for today:

**Nested sets.** Unless overridden, the `Object#eql?` method considers two objects to be same if they are identical. In the current context, overriding `Object#eql?` is critical, because `eql?` is the method that Ruby uses when accessing hash keys. Lets leave the context of our `SetLike` module for a moment, and consider this line of Ruby code:

```ruby
some_hash[some_obj]
```

When executing this line, Ruby will check if there is a key `key` to be found in `some_hash` with the property that `some_obj.eql?(key)`. If so, the value for `key` will be returned.

For our purposes, this is crucial because we would like to be able to model nested sets, i.e., sets that have sets among their keys. Consider:

```ruby
set1 = ClassicalSet[1, 2, 3]
set2 = ClassicalSet[set1, 4]
set3 = ClassicalSet[set1, 4]
set2 == set3 #=> ?
```

The `ClassicalSet.[]` method, which we have not encountered so far, initializes a new instance of `ClassicalSet` and feeds the arguments provided as keys into the set (associating them with the score `1`).

Now the question is whether `set2` and `set3` are the same set. It seems that the answer should be yes, because, after all, they *contain the same elements*. If we do not override `eql?`, however, `set2` and `set3` will not come out equivalent, because `set2` and `set3` do not reference the same object, hence are not the same according to `Object#eql?`. And since we are using a hash internally, this matters, because `self[set1] == other[set1]` will fail. However, `SetLike#eql?`, as defined above, will do the job. Continuing in this vein, and as mentioned in the Ruby documentation for the Hash class, we also need to override the `Object#hash` method to ensure that two set objects that are `eql?` also have the same return value when `hash` is invoked.

```ruby
def hash
  each.map(&:hash).sum
end
```

Here, we simply each key-value pair (a two-element array) to its `hash` return value, trusting that `Array#hash` is implemented in a meaningful way.

**Coda.** This has been a long post. I hope I have not exhausted your patience by discussing too many technicalities. Coming up with a first working implementation of the types of sets discussed here was pretty straightforward. However, arriving at a way to structure and modularize my code that I found convincing myself required me to go back to the drawing board several times. If you have a chance to [check out my code](http://www.github.com), your feedback would be greatly appreciated.
