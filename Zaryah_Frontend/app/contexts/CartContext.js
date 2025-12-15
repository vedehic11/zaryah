'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'
import { apiService } from '../services/api'

const CartContext = createContext()

export const useCart = () => {
  return useContext(CartContext)
}

export const CartProvider = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);

  // Debug function to manually test cart (for development only)
  const debugCart = async () => {
    if (user && user.token) {
      try {
        await apiService.testCart();
      } catch (error) {
        console.error('Backend test error:', error);
      }
    }
  };

  // Load saved addresses for logged-in users
  useEffect(() => {
    if (user && user.token) {
      loadSavedAddresses();
    }
  }, [user]);

  const loadSavedAddresses = async () => {
    try {
      // For now, load from localStorage. Later we can add backend API
      const saved = localStorage.getItem(`addresses_${user.id}`);
      if (saved) {
        const addresses = JSON.parse(saved);
        setSavedAddresses(addresses);
      }
    } catch (error) {
      console.error('Error loading saved addresses:', error);
    }
  };

  const saveAddress = async (address) => {
    try {
      const newAddress = {
        ...address,
        id: Date.now().toString(),
        isDefault: savedAddresses.length === 0 // First address becomes default
      };
      
      const updatedAddresses = [...savedAddresses, newAddress];
      setSavedAddresses(updatedAddresses);
      
      // Save to localStorage
      localStorage.setItem(`addresses_${user.id}`, JSON.stringify(updatedAddresses));
      
      return newAddress;
    } catch (error) {
      console.error('Error saving address:', error);
      throw error;
    }
  };

  const updateAddress = async (addressId, updatedAddress) => {
    try {
      const updatedAddresses = savedAddresses.map(addr => 
        addr.id === addressId ? { ...addr, ...updatedAddress } : addr
      );
      setSavedAddresses(updatedAddresses);
      localStorage.setItem(`addresses_${user.id}`, JSON.stringify(updatedAddresses));
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  };

  const deleteAddress = async (addressId) => {
    try {
      const updatedAddresses = savedAddresses.filter(addr => addr.id !== addressId);
      setSavedAddresses(updatedAddresses);
      localStorage.setItem(`addresses_${user.id}`, JSON.stringify(updatedAddresses));
      
      // If deleted address was selected, clear selection
      if (selectedAddress && selectedAddress.id === addressId) {
        setSelectedAddress(null);
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  };

  const setDefaultAddress = async (addressId) => {
    try {
      const updatedAddresses = savedAddresses.map(addr => ({
        ...addr,
        isDefault: addr.id === addressId
      }));
      setSavedAddresses(updatedAddresses);
      localStorage.setItem(`addresses_${user.id}`, JSON.stringify(updatedAddresses));
    } catch (error) {
      console.error('Error setting default address:', error);
      throw error;
    }
  };

  // Test function to manually add an item to cart (for development only)
  const testAddToCart = async () => {
    const testProduct = {
      _id: 'test-product-123',
      name: 'Test Product',
      price: 100,
      description: 'Test product for debugging'
    };
    await addToCart(testProduct, { quantity: 2 });
  };

  // Expose debug function globally for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.debugCart = debugCart;
      window.testAddToCart = testAddToCart;
    }
  }, [user, cart, cartLoaded]);

  // Helper function to transform backend cart data to frontend format
  const transformBackendCart = (backendCart) => {
    if (!backendCart || !backendCart.items) {
      return [];
    }
    
    return backendCart.items.map(item => {
      
      // Handle both populated and unpopulated product references
      const product = item.product;
      if (!product) {
        console.warn('CartContext: Product not found for item:', item);
        return null;
      }
      
      return {
        ...product,
        quantity: item.quantity,
        giftPackaging: item.giftPackaging || false,
        customizations: item.customizations || [],
        cartItemId: product._id || product.id, // Use product ID as cart item ID
        price: product.price
      };
    }).filter(Boolean); // Remove null items
  };

  // Fetch cart from backend for logged-in users, localStorage for guests
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Add a small delay to ensure user is fully loaded
    const timer = setTimeout(() => {
      fetchCart();
    }, 100);

    return () => clearTimeout(timer);
  }, [user, authLoading]);

  const fetchCart = async () => {
    if (user && user.token) {
      // Logged-in user: fetch from backend
      try {
        setLoading(true);
        const backendCart = await apiService.getCart();
        
        // Transform backend cart items to frontend format
        const transformedCart = transformBackendCart(backendCart);
        setCart(transformedCart);
      } catch (error) {
        console.error('CartContext: Error fetching cart from backend:', error);
        // If backend fails, try to load from localStorage as fallback
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          try {
            const parsedCart = JSON.parse(savedCart);
            setCart(parsedCart);
          } catch (e) {
            console.error('CartContext: Error parsing localStorage cart:', e);
            setCart([]);
          }
        } else {
          setCart([]);
        }
      } finally {
        setLoading(false);
        setCartLoaded(true);
      }
    } else {
      // Guest user: load from localStorage
      const savedCart = localStorage.getItem('cart');
      
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          setCart(parsedCart);
        } catch (error) {
          console.error('CartContext: Error parsing localStorage cart:', error);
          setCart([]);
        }
      } else {
        setCart([]);
      }
      setCartLoaded(true);
    }
  };

  // Save guest cart to localStorage (only for guests)
  useEffect(() => {
    if (!user && cartLoaded) {
      try {
        localStorage.setItem('cart', JSON.stringify(cart));
      } catch (error) {
        console.error('CartContext: Error saving to localStorage:', error);
      }
    }
  }, [cart, user, cartLoaded]);

  // Add item to cart
  const addToCart = async (product, options = {}) => {
    const { quantity = 1, giftPackaging = false, customizations = [] } = options;
    
    if (user && user.token) {
      // Logged-in user: add to backend
      try {
        setLoading(true);
        const productId = product.id || product._id
        
        await apiService.addItemToCart({
          productId,
          quantity,
          giftPackaging,
          customizations
        });
        
        // Refetch cart from backend to get updated state
        const backendCart = await apiService.getCart();
        
        // Transform backend cart items to frontend format
        const transformedCart = transformBackendCart(backendCart);
        setCart(transformedCart);
        toast.success(`${product.name} added to cart!`);
        setIsCartOpen(true);
      } catch (error) {
        console.error('CartContext: Error adding to backend cart:', error);
        toast.error('Failed to add item to cart');
      } finally {
        setLoading(false);
      }
    } else {
      // Guest user: add to localStorage
      setCart(prevCart => {
        const productId = product.id || product._id
        const existingItemIndex = prevCart.findIndex(
          item => (item.id || item._id) === productId && 
          JSON.stringify(item.customizations) === JSON.stringify(customizations)
        );
        
        let newCart;
        if (existingItemIndex !== -1) {
          newCart = [...prevCart];
          newCart[existingItemIndex].quantity += quantity;
        } else {
          newCart = [...prevCart, {
            ...product,
            quantity,
            giftPackaging,
            customizations,
            cartItemId: Date.now() + Math.random() // Unique ID for guest items
          }];
        }
        
        toast.success(`${product.name} added to cart!`);
        setIsCartOpen(true);
        return newCart;
      });
    }
  };

  // Remove item from cart
  const removeFromCart = async (cartItemId) => {
    if (user && user.token) {
      // Logged-in user: remove from backend
      try {
        setLoading(true);
        
        await apiService.removeItemFromCart(cartItemId);
        
        // Refetch cart from backend
        const backendCart = await apiService.getCart();
        
        // Transform backend cart items to frontend format
        const transformedCart = transformBackendCart(backendCart);
        setCart(transformedCart);
        toast.error('Item removed from cart');
      } catch (error) {
        console.error('CartContext: Error removing from backend cart:', error);
        toast.error('Failed to remove item');
      } finally {
        setLoading(false);
      }
    } else {
      // Guest user: remove from localStorage
      setCart(prevCart => {
        const newCart = prevCart.filter(item => item.cartItemId !== cartItemId);
        toast.error('Item removed from cart');
        return newCart;
      });
    }
  };

  // Update item quantity
  const updateQuantity = async (cartItemId, newQuantity) => {
    if (user && user.token) {
      // Logged-in user: update in backend
      try {
        setLoading(true);
        
        await apiService.updateCartItem({ productId: cartItemId, quantity: newQuantity });
        
        // Refetch cart from backend
        const backendCart = await apiService.getCart();
        
        // Transform backend cart items to frontend format
        const transformedCart = transformBackendCart(backendCart);
        setCart(transformedCart);
      } catch (error) {
        console.error('CartContext: Error updating quantity in backend cart:', error);
        toast.error('Failed to update quantity');
      } finally {
        setLoading(false);
      }
    } else {
      // Guest user: update in localStorage
      setCart(prevCart =>
        prevCart.map(item =>
          item.cartItemId === cartItemId 
            ? { ...item, quantity: Math.max(1, newQuantity) }
            : item
        )
      );
    }
  };

  // Clear cart
  const clearCart = async () => {
    if (user && user.token) {
      // Logged-in user: clear backend cart
      try {
        setLoading(true);
        
        await apiService.clearCart();
        setCart([]);
        toast.info('Cart cleared');
      } catch (error) {
        console.error('CartContext: Error clearing backend cart:', error);
        setCart([]);
      } finally {
        setLoading(false);
      }
    } else {
      // Guest user: clear localStorage cart
      setCart([]);
      localStorage.removeItem('cart');
      toast.info('Cart cleared');
    }
  };

  // Sync guest cart to backend when user logs in - REMOVED
  // const syncGuestCartToBackend = async () => {
  //   if (!user || !user.token || cart.length === 0) return;
  //   
  //   try {
  //     console.log('CartContext: Syncing guest cart to backend');
  //     setLoading(true);
  //     
  //     // Add each guest cart item to backend
  //     for (const item of cart) {
  //       await apiService.addItemToCart({
  //         productId: item._id,
  //         quantity: item.quantity,
  //         giftPackaging: item.giftPackaging || false,
  //         customizations: item.customizations || []
  //       });
  //     }
  //     
  //     // Clear localStorage cart
  //     localStorage.removeItem('cart');
  //     
  //     // Refetch cart from backend
  //     const backendCart = await apiService.getCart();
  //     console.log('CartContext: Backend cart after syncing:', backendCart);
  //     
  //     // Transform backend cart items to frontend format
  //     const transformedCart = transformBackendCart(backendCart);
  //     setCart(transformedCart);
  //     // toast.success('Guest cart synced to your account!'); // Removed this notification
  //   } catch (error) {
  //     console.error('CartContext: Error syncing guest cart:', error);
  //     toast.error('Failed to sync guest cart');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // Calculate totals
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => {
    const itemPrice = item.price * item.quantity;
    const giftPrice = item.giftPackaging ? 30 * item.quantity : 0;
    return sum + itemPrice + giftPrice;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isCartOpen,
        setIsCartOpen,
        loading,
        cartLoaded,
        savedAddresses,
        saveAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        selectedAddress,
        setSelectedAddress
      }}
    >
      {children}
    </CartContext.Provider>
  );
};