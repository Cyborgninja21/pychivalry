# CK3 Scope Timing - The Golden Rule

## Overview

The **Golden Rule** of CK3 event scripting states:

> **Scopes created in `immediate` are NOT available in `trigger`, `desc`, or `title` blocks because those blocks evaluate BEFORE immediate runs.**

This is the #1 source of runtime errors for new CK3 modders, resulting in `ERROR:[scope_name.Function]` appearing in-game.

## Event Evaluation Order

Understanding the order in which event blocks are evaluated is crucial:

```
1. trigger = { }           ← Evaluated FIRST (pre-display)
2. desc/title              ← Evaluated SECOND (pre-display, localization parsed)
3. immediate = { }         ← Runs THIRD (execution begins, scopes created here)
4. portraits               ← Displayed FOURTH (scopes NOW available)
5. options                 ← Rendered FIFTH (scopes available)
```

## Scope Availability Matrix

| Block | root | Calling Event Scopes | Variables (var:) | Scopes from immediate |
|-------|------|---------------------|------------------|----------------------|
| **trigger** | ✅ | ✅ | ✅ | **❌ CK3550** |
| **desc** | ✅ | ✅ | ✅ | **❌ CK3560** |
| **title** | ✅ | ✅ | ✅ | **❌ CK3561** |
| **triggered_desc triggers** | ✅ | ✅ | ✅ | **❌ CK3552** |
| **immediate** | ✅ | ✅ | ✅ | ✅ (create here) |
| **portrait triggers** | ✅ | ✅ | ✅ | ✅ |
| **option** | ✅ | ✅ | ✅ | ✅ |

## Common Violations

### ❌ CK3560: Scope in Desc Localization (Most Common)

**Incorrect:**
```pdx
# Event file
my_event.001 = {
    desc = my_event.001.desc    # ← Localization references scope:target

    immediate = {
        random_courtier = { save_scope_as = target }  # ← Created too late!
    }
}
```

```yaml
# Localization file
my_event.001.desc:0 "[scope:target.GetFirstName] approaches you..."
#                     ^^^^^^^^^^^^^^^^^^^^^^^^ ERROR! Scope doesn't exist yet
```

**Result:** In-game you see: `ERROR:[target.GetFirstName] approaches you...`

**Fix 1 - Pass Scope from Caller:**
```pdx
# Parent event
parent.001 = {
    immediate = {
        random_courtier = { save_scope_as = target }  # Create scope here

        trigger_event = {
            id = my_event.001
            # target scope is automatically passed
        }
    }
}

# Child event
my_event.001 = {
    desc = my_event.001.desc    # ✅ scope:target comes from parent

    immediate = {
        # No save_scope_as needed - scope already exists
        add_gold = 100
    }
}
```

**Fix 2 - Use Variable Instead:**
```pdx
my_event.001 = {
    trigger = {
        any_courtier = { save_temporary_scope_as = target }  # ✅ Check exists
    }

    desc = my_event.001.desc

    immediate = {
        random_courtier = {
            limit = { always = yes }  # Or add actual conditions
            save_scope_as = target
        }
    }
}
```

**Fix 3 - Move Desc to Options:**
```pdx
my_event.001 = {
    desc = my_event.001.desc.generic  # Generic desc without scope reference

    immediate = {
        random_courtier = { save_scope_as = target }
    }

    option = {
        name = my_event.001.a  # This localization CAN use scope:target
        # Localization: "Speak with [scope:target.GetName]" ✅
    }
}
```

---

### ❌ CK3561: Scope in Title Localization

**Incorrect:**
```pdx
my_event.002 = {
    title = my_event.002.t

    immediate = {
        random_vassal = { save_scope_as = vassal }
    }
}
```

```yaml
my_event.002.t:0 "Meeting with [scope:vassal.GetTitledFirstName]"
#                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^ ERROR!
```

**Fix:** Same strategies as CK3560 - pass from parent or use generic title.

---

### ❌ CK3550: Scope in Trigger Block

**Incorrect:**
```pdx
my_event.003 = {
    trigger = {
        scope:target = { is_alive = yes }  # ← ERROR! Scope doesn't exist yet
    }

    immediate = {
        random_friend = { save_scope_as = target }
    }
}
```

**Fix - Add Trigger Guard:**
```pdx
my_event.003 = {
    trigger = {
        any_friend = {
            is_alive = yes
        }
    }

    immediate = {
        random_friend = { save_scope_as = target }
    }
}
```

---

### ❌ CK3552: Scope in Triggered Desc Trigger

**Incorrect:**
```pdx
my_event.004 = {
    desc = {
        triggered_desc = {
            trigger = { scope:friend = { is_male = yes } }  # ← ERROR!
            desc = my_event.004.desc.male
        }
        desc = my_event.004.desc.default
    }

    immediate = {
        random_friend = { save_scope_as = friend }
    }
}
```

**Fix - Use Variable Check:**
```pdx
my_event.004 = {
    immediate = {
        random_friend = { save_scope_as = friend }

        # Set a variable for triggered_desc
        if = {
            limit = { scope:friend = { is_male = yes } }
            set_variable = { name = friend_is_male value = yes }
        }
    }

    desc = {
        triggered_desc = {
            trigger = { has_variable = friend_is_male }  # ✅ Variable check
            desc = my_event.004.desc.male
        }
        desc = my_event.004.desc.default
    }

    option = { name = my_event.004.a }
}
```

---

## Safe Patterns

### ✅ Built-in Scopes (Always Available)

These scopes are **always** available and don't need `save_scope_as`:

```pdx
my_event.005 = {
    desc = my_event.005.desc  # Can reference ROOT, actor, etc.

    trigger = {
        # All of these are safe:
        ROOT = { is_adult = yes }
        actor = { is_alive = yes }
        recipient = { is_ai = no }
    }
}
```

**Built-in scopes:**
- `ROOT` / `root`
- `THIS` / `this`
- `PREV` / `prev`
- `FROM` / `from`
- `actor` / `recipient`
- `liege` / `spouse` / `father` / `mother`
- `killer` / `imprisoner` / `guardian`

### ✅ Scopes Passed from Parent Event

```pdx
# Parent creates scope
parent.001 = {
    immediate = {
        random_courtier = { save_scope_as = target }
        trigger_event = my_event.006
    }
}

# Child receives scope
my_event.006 = {
    # ✅ Safe: scope:target comes from parent
    trigger = { scope:target = { is_alive = yes } }
    desc = my_event.006.desc  # Can reference scope:target in localization
}
```

### ✅ Scopes in Options (Evaluate After Immediate)

```pdx
my_event.007 = {
    immediate = {
        random_prisoner = { save_scope_as = prisoner }
    }

    option = {
        # ✅ Safe: options evaluate AFTER immediate
        name = my_event.007.a
        # Localization can use: [scope:prisoner.GetName]

        trigger = {
            scope:prisoner = { is_alive = yes }  # ✅ Safe
        }
    }
}
```

---

## Diagnostic Codes

| Code | Severity | Description |
|------|----------|-------------|
| **CK3550** | Error | Scope used in `trigger` but defined in `immediate` |
| **CK3551** | Warning | Scope used in `desc` block but defined in `immediate` |
| **CK3552** | Error | Scope used in `triggered_desc` trigger but defined in `immediate` |
| **CK3560** | Error | Scope used in `desc` **localization** but defined in `immediate` (NEW) |
| **CK3561** | Error | Scope used in `title` **localization** but defined in `immediate` (NEW) |

---

## Summary

**Remember the Golden Rule:**

1. **trigger** and **desc/title** evaluate BEFORE immediate
2. Scopes created in immediate are NOT available in those blocks
3. Use one of these safe patterns:
   - Pass scope from parent event
   - Use variables instead of scopes in triggers
   - Reference scopes only in options (which evaluate after immediate)
   - Use built-in scopes (root, actor, etc.)

**Pro tip:** If you're creating a scope with `random_X` in immediate, add a corresponding `any_X` check in trigger to ensure the random selection will succeed.

---

## Further Reading

- [CK3 Wiki: Event Modding](https://ck3.paradoxwikis.com/Event_modding)
- [Scope Chains Documentation](scopes.md)
- [Variable System](variables.md)
